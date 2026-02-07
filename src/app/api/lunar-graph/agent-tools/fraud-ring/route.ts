// API Route: Agent Tool - Get Fraud Ring Details
// Get detailed information about a specific fraud ring

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
    const ringId = searchParams.get('id');
    const ringName = searchParams.get('name');
    const severity = searchParams.get('severity'); // critical, high, medium, low
    const type = searchParams.get('type'); // opposite_trading, multi_account, etc.

    const supabase = getSupabaseClient();

    let query = supabase
      .from('fraud_rings')
      .select('*')
      .order('exposure', { ascending: false });

    if (ringId) {
      query = query.eq('id', ringId);
    } else if (ringName) {
      query = query.ilike('name', `%${ringName}%`);
    }

    if (severity) {
      query = query.eq('severity', severity.toLowerCase());
    }

    if (type) {
      query = query.eq('type', type.toLowerCase());
    }

    const { data: fraudRings, error } = await query.limit(10);

    if (error || !fraudRings || fraudRings.length === 0) {
      return NextResponse.json({
        message: 'No fraud rings found matching your criteria',
        searchedFor: { id: ringId, name: ringName, severity, type },
      });
    }

    // Get risk scores from latest graph snapshot
    const { data: snapshotData } = await supabase
      .from('graph_snapshots')
      .select('nodes')
      .order('created_at', { ascending: false })
      .limit(1);

    const graphNodes: Array<{ id: string; riskScore?: number }> = snapshotData?.[0]?.nodes || [];
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Get detailed info for each fraud ring
    const ringDetails = await Promise.all(fraudRings.map(async (ring) => {
      const entityIds = ring.entities || [];

      // Get entity details
      const [affiliatesResult, clientsResult] = await Promise.all([
        supabase
          .from('affiliates')
          .select('id, name, email')
          .in('id', entityIds),
        supabase
          .from('clients')
          .select('id, deriv_account_id')
          .in('id', entityIds),
      ]);

      const affiliates = (affiliatesResult.data || []).map(a => ({
        ...a,
        entityType: 'affiliate',
        riskScore: riskScoreMap.get(a.id) || 0,
      }));
      const clients = (clientsResult.data || []).map(c => ({
        ...c,
        name: c.deriv_account_id, // Map deriv_account_id to name for consistent response
        entityType: 'client',
        riskScore: riskScoreMap.get(c.id) || 0,
      }));
      const allEntities = [...affiliates, ...clients];

      return {
        id: ring.id,
        name: ring.name,
        type: ring.type?.replace(/_/g, ' '),
        typeDescription: getTypeDescription(ring.type),
        severity: ring.severity,
        confidence: ring.confidence,
        financialExposure: ring.exposure,
        status: ring.status,
        createdAt: ring.created_at,
        aiSummary: ring.ai_summary,

        involvedEntities: {
          totalCount: allEntities.length,
          affiliateCount: affiliates.length,
          clientCount: clients.length,
          entities: allEntities.map(e => ({
            type: e.entityType,
            name: e.name,
            email: 'email' in e ? e.email : undefined,
            riskScore: e.riskScore,
          })),
        },

        evidence: (ring.evidence || []).map((e: any) => ({
          type: e.type,
          description: e.description,
          confidence: e.confidence,
        })),

        recommendedActions: getRecommendedActions(ring),
      };
    }));

    return NextResponse.json({
      resultsFound: ringDetails.length,
      totalExposure: ringDetails.reduce((sum, r) => sum + (r.financialExposure || 0), 0),
      fraudRings: ringDetails,
    });
  } catch (error) {
    console.error('[AgentTool] Fraud ring error:', error);
    return NextResponse.json(
      { error: 'Failed to get fraud ring details' },
      { status: 500 }
    );
  }
}

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'opposite_trading': 'Coordinated CALL and PUT trades on the same symbol to guarantee profits regardless of market movement',
    'multi_account': 'Multiple accounts operated by the same person using shared devices or IP addresses',
    'ip_clustering': 'Suspicious clustering of accounts from the same IP address or IP range',
    'commission_pumping': 'High volume of small trades designed to generate affiliate commissions without real trading intent',
    'timing_coordination': 'Trades executed with suspicious timing patterns suggesting coordination',
  };
  return descriptions[type] || 'Suspicious pattern detected';
}

function getRecommendedActions(ring: any): string[] {
  const actions: string[] = [];

  if (ring.severity === 'critical') {
    actions.push('Immediately freeze accounts of all involved entities');
    actions.push('Escalate to compliance team');
  }

  if (ring.severity === 'high' || ring.severity === 'critical') {
    actions.push('Review all recent transactions');
    actions.push('Document evidence for potential legal action');
  }

  if (ring.type === 'opposite_trading') {
    actions.push('Check for coordinated trade pairs');
    actions.push('Review profit distribution between accounts');
  }

  if (ring.type === 'multi_account') {
    actions.push('Verify identity documents');
    actions.push('Compare device fingerprints and IP addresses');
  }

  if (ring.exposure > 10000) {
    actions.push('Calculate total financial impact');
    actions.push('Consider fund recovery options');
  }

  actions.push('Update entity risk scores');
  actions.push('Add to watchlist for ongoing monitoring');

  return actions;
}
