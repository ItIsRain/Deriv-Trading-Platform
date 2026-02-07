// API Route: Agent Tool - Compare Entities
// Compare two or more entities to find connections and similarities

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase config missing');
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const names = searchParams.get('names')?.split(',').map(n => n.trim()) || [];

    if (names.length < 2) {
      return NextResponse.json({
        error: 'Please provide at least 2 entity names separated by commas',
        example: '/api/lunar-graph/agent-tools/compare?names=John,Jane',
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Find all entities by name
    const entities: any[] = [];

    for (const name of names.slice(0, 5)) { // Max 5 entities
      const [affiliatesResult, clientsResult] = await Promise.all([
        supabase
          .from('affiliates')
          .select('id, name, email')
          .ilike('name', `%${name}%`)
          .limit(1),
        supabase
          .from('clients')
          .select('id, deriv_account_id, affiliate_id')
          .ilike('deriv_account_id', `%${name}%`)
          .limit(1),
      ]);

      if (affiliatesResult.data?.length) {
        entities.push({ ...affiliatesResult.data[0], entityType: 'affiliate', searchTerm: name });
      } else if (clientsResult.data?.length) {
        // Map deriv_account_id to name for consistent response
        const client = clientsResult.data[0];
        entities.push({ ...client, name: client.deriv_account_id, entityType: 'client', searchTerm: name });
      } else {
        entities.push({ searchTerm: name, notFound: true });
      }
    }

    const foundEntities = entities.filter(e => !e.notFound);
    const entityIds = foundEntities.map(e => e.id);

    if (foundEntities.length < 2) {
      return NextResponse.json({
        message: 'Could not find enough entities to compare',
        searchResults: entities.map(e => ({
          searchTerm: e.searchTerm,
          found: !e.notFound,
          name: e.name,
        })),
      });
    }

    // Get edges and nodes from the latest graph snapshot
    const { data: snapshotData } = await supabase
      .from('graph_snapshots')
      .select('edges, nodes')
      .order('created_at', { ascending: false })
      .limit(1);

    const allEdges: Array<{
      source?: string;
      target?: string;
      type?: string;
      is_fraud_indicator?: boolean;
      metadata?: { description?: string };
    }> = snapshotData?.[0]?.edges || [];

    // Build risk score map from graph nodes
    const graphNodes: Array<{ id: string; riskScore?: number }> = snapshotData?.[0]?.nodes || [];
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Add risk scores to found entities
    foundEntities.forEach(e => {
      e.riskScore = riskScoreMap.get(e.id) || 0;
    });

    // Filter edges that involve our entities
    const relevantEdges = allEdges.filter(edge =>
      entityIds.includes(edge.source as string) || entityIds.includes(edge.target as string)
    );

    // Find mutual connections (edges between the compared entities)
    const mutualConnections = relevantEdges.filter(edge =>
      entityIds.includes(edge.source as string) && entityIds.includes(edge.target as string)
    );

    // Check if they share fraud rings
    const { data: fraudRings } = await supabase
      .from('fraud_rings')
      .select('id, name, type, severity, entities');

    const sharedFraudRings: any[] = [];
    (fraudRings || []).forEach(ring => {
      const entitiesInRing = entityIds.filter(id => ring.entities?.includes(id));
      if (entitiesInRing.length > 1) {
        sharedFraudRings.push({
          name: ring.name,
          type: ring.type?.replace(/_/g, ' '),
          severity: ring.severity,
          entitiesInvolved: entitiesInRing.length,
        });
      }
    });

    // Check for same affiliate
    const clientEntities = foundEntities.filter(e => e.entityType === 'client');
    const sameAffiliate = clientEntities.length > 1 &&
      clientEntities.every(c => c.affiliate_id === clientEntities[0].affiliate_id);

    return NextResponse.json({
      entitiesCompared: foundEntities.length,

      entities: foundEntities.map(e => ({
        name: e.name,
        type: e.entityType,
        email: e.email,
        riskScore: e.riskScore,
      })),

      directConnections: {
        count: mutualConnections.length,
        connections: mutualConnections.map(c => ({
          type: c.type?.replace(/_/g, ' '),
          isFraudIndicator: c.is_fraud_indicator,
          description: c.metadata?.description,
        })),
      },

      sharedFraudRings: {
        count: sharedFraudRings.length,
        rings: sharedFraudRings,
      },

      commonalities: {
        sameAffiliate: sameAffiliate,
        inSameFraudRing: sharedFraudRings.length > 0,
        haveDirectConnection: mutualConnections.length > 0,
        haveFraudConnection: mutualConnections.some(c => c.is_fraud_indicator),
      },

      riskAssessment: {
        averageRiskScore: Math.round(
          foundEntities.reduce((sum, e) => sum + (e.riskScore || 0), 0) / foundEntities.length
        ),
        highestRiskEntity: foundEntities.reduce((max, e) =>
          (e.riskScore || 0) > (max.riskScore || 0) ? e : max
        ).name,
        suspiciousRelationship: sharedFraudRings.length > 0 ||
          mutualConnections.some(c => c.is_fraud_indicator),
      },
    });
  } catch (error) {
    console.error('[AgentTool] Compare error:', error);
    return NextResponse.json(
      { error: 'Failed to compare entities' },
      { status: 500 }
    );
  }
}
