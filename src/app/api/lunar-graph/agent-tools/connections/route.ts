// API Route: Agent Tool - Get Connections/Edges
// Get connections between entities (fraud indicators, referrals, shared IPs, etc.)

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
    const entityId = searchParams.get('entity_id');
    const entityName = searchParams.get('entity_name');
    const connectionType = searchParams.get('type'); // referral, ip_overlap, device_match, etc.
    const fraudOnly = searchParams.get('fraud_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = getSupabaseClient();

    // Resolve entity name to ID if needed
    let resolvedEntityId = entityId;
    if (entityName && !entityId) {
      const [affiliatesResult, clientsResult] = await Promise.all([
        supabase
          .from('affiliates')
          .select('id')
          .ilike('name', `%${entityName}%`)
          .limit(1),
        supabase
          .from('clients')
          .select('id')
          .ilike('deriv_account_id', `%${entityName}%`)
          .limit(1),
      ]);

      if (affiliatesResult.data?.length) {
        resolvedEntityId = affiliatesResult.data[0].id;
      } else if (clientsResult.data?.length) {
        resolvedEntityId = clientsResult.data[0].id;
      }
    }

    // Get edges and nodes from the latest graph snapshot
    const { data: snapshotData, error } = await supabase
      .from('graph_snapshots')
      .select('edges, nodes')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[AgentTool] Connections query error:', error);
    }

    // Build risk score map from graph nodes
    const graphNodes: Array<{ id: string; riskScore?: number }> = snapshotData?.[0]?.nodes || [];
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Extract and filter edges
    let edgeList: Array<{
      type?: string;
      source?: string;
      target?: string;
      is_fraud_indicator?: boolean;
      weight?: number;
      metadata?: { confidence?: number; description?: string };
    }> = snapshotData?.[0]?.edges || [];

    // Apply filters
    if (resolvedEntityId) {
      edgeList = edgeList.filter(e => e.source === resolvedEntityId || e.target === resolvedEntityId);
    }

    if (connectionType) {
      edgeList = edgeList.filter(e => e.type?.toLowerCase() === connectionType.toLowerCase());
    }

    if (fraudOnly) {
      edgeList = edgeList.filter(e => e.is_fraud_indicator);
    }

    // Sort by weight and limit
    edgeList = edgeList
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, limit);

    // Get entity names for the connections
    const entityIds = new Set<string>();
    edgeList.forEach(e => {
      if (e.source) entityIds.add(e.source);
      if (e.target) entityIds.add(e.target);
    });

    const [affiliatesResult, clientsResult] = await Promise.all([
      supabase
        .from('affiliates')
        .select('id, name')
        .in('id', Array.from(entityIds)),
      supabase
        .from('clients')
        .select('id, deriv_account_id, affiliate_id')
        .in('id', Array.from(entityIds)),
    ]);

    const entityMap = new Map();
    (affiliatesResult.data || []).forEach(a => {
      entityMap.set(a.id, { ...a, type: 'affiliate', riskScore: riskScoreMap.get(a.id) || 0 });
    });
    (clientsResult.data || []).forEach(c => {
      // Map deriv_account_id to name, use affiliate's risk score (clients aren't in graph)
      const affiliateRisk = c.affiliate_id ? (riskScoreMap.get(c.affiliate_id) || 0) : 0;
      entityMap.set(c.id, { ...c, name: c.deriv_account_id, type: 'client', riskScore: affiliateRisk });
    });

    // Group by connection type
    const byType: Record<string, any[]> = {};
    edgeList.forEach(e => {
      const type = e.type || 'unknown';
      if (!byType[type]) byType[type] = [];
      byType[type].push(e);
    });

    const fraudConnections = edgeList.filter(e => e.is_fraud_indicator);

    return NextResponse.json({
      totalConnections: edgeList.length,
      fraudIndicatorConnections: fraudConnections.length,

      connectionsByType: Object.entries(byType).map(([type, edges]) => ({
        type: type.replace(/_/g, ' '),
        count: edges.length,
        fraudIndicators: edges.filter(e => e.is_fraud_indicator).length,
      })),

      connections: edgeList.slice(0, 30).map(e => {
        const source = entityMap.get(e.source);
        const target = entityMap.get(e.target);
        return {
          type: e.type?.replace(/_/g, ' '),
          isFraudIndicator: e.is_fraud_indicator,
          weight: e.weight,
          confidence: e.metadata?.confidence,
          description: e.metadata?.description,
          source: source ? {
            name: source.name,
            type: source.type,
            riskScore: source.riskScore,
          } : { id: e.source },
          target: target ? {
            name: target.name,
            type: target.type,
            riskScore: target.riskScore,
          } : { id: e.target },
        };
      }),

      fraudPatternSummary: {
        ipOverlaps: byType['ip_overlap']?.length || 0,
        deviceMatches: byType['device_match']?.length || 0,
        timingSyncs: byType['timing_sync']?.length || 0,
        oppositePositions: byType['opposite_position']?.length || 0,
      },
    });
  } catch (error) {
    console.error('[AgentTool] Connections error:', error);
    return NextResponse.json(
      { error: 'Failed to get connections' },
      { status: 500 }
    );
  }
}
