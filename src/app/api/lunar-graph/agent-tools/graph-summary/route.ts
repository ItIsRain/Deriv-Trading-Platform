// API Route: Agent Tool - Get Graph Summary
// ElevenLabs agent calls this to get real-time graph overview

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
    const supabase = getSupabaseClient();

    // Fetch all data in parallel
    const [affiliatesResult, clientsResult, tradesResult, snapshotResult] = await Promise.all([
      supabase.from('affiliates').select('id, name, email'),
      supabase.from('clients').select('id, deriv_account_id'),
      supabase.from('trades').select('id, contract_type, symbol, amount, profit'),
      supabase.from('graph_snapshots').select('edges, nodes').order('created_at', { ascending: false }).limit(1),
    ]);

    const affiliates = affiliatesResult.data || [];
    const clients = clientsResult.data || [];
    const trades = tradesResult.data || [];

    // Extract edges and nodes from latest graph snapshot
    const snapshotData = snapshotResult.data?.[0];
    const edges: Array<{ type?: string; is_fraud_indicator?: boolean; weight?: number; source?: string; target?: string }> = snapshotData?.edges || [];
    const graphNodes: Array<{ id: string; type: string; label: string; riskScore?: number }> = snapshotData?.nodes || [];

    // Build risk score map from graph nodes
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Calculate average risk score from graph nodes
    const entityRiskScores = graphNodes
      .filter(n => n.type === 'affiliate' || n.type === 'client')
      .map(n => n.riskScore || 0);
    const avgRiskScore = entityRiskScores.length > 0
      ? Math.round(entityRiskScores.reduce((a, b) => a + b, 0) / entityRiskScores.length)
      : 0;

    // Fraud edges
    const fraudEdges = edges.filter(e => e.is_fraud_indicator);

    // Edge types breakdown
    const edgesByType: Record<string, { total: number; fraud: number }> = {};
    edges.forEach(e => {
      const type = e.type || 'unknown';
      if (!edgesByType[type]) {
        edgesByType[type] = { total: 0, fraud: 0 };
      }
      edgesByType[type].total++;
      if (e.is_fraud_indicator) {
        edgesByType[type].fraud++;
      }
    });

    // Get high risk entities from graph nodes (more accurate)
    const highRiskEntities = graphNodes
      .filter(n => (n.type === 'affiliate' || n.type === 'client') && (n.riskScore || 0) >= 50)
      .map(n => {
        const match = n.id.match(/^(affiliate|client)_(.+)$/);
        const entityId = match ? match[2] : n.id;
        const entity = n.type === 'affiliate'
          ? affiliates.find(a => a.id === entityId)
          : clients.find(c => c.id === entityId);
        // Affiliates have name/email, clients have deriv_account_id
        const displayName = n.type === 'affiliate'
          ? (entity as any)?.name
          : (entity as any)?.deriv_account_id;
        return {
          type: n.type,
          name: displayName || n.label,
          email: n.type === 'affiliate' ? (entity as any)?.email : undefined,
          riskScore: n.riskScore || 0,
        };
      })
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));

    const summary = {
      // Node counts
      totalNodes: affiliates.length + clients.length + trades.length,
      affiliateCount: affiliates.length,
      clientCount: clients.length,
      tradeCount: trades.length,

      // Edge/Connection counts
      totalEdges: edges.length,
      fraudEdges: fraudEdges.length,
      nonFraudEdges: edges.length - fraudEdges.length,

      // Edge types
      edgeTypes: Object.entries(edgesByType).map(([type, counts]) => ({
        type: type.replace(/_/g, ' '),
        total: counts.total,
        fraudIndicators: counts.fraud,
      })),

      // Risk metrics
      averageRiskScore: avgRiskScore,
      highRiskEntityCount: highRiskEntities.length,

      // High risk entities list
      highRiskEntities: highRiskEntities.slice(0, 15),

      // Summary text
      summaryText: `Knowledge graph contains ${affiliates.length + clients.length} entities and ${trades.length} trades. ${edges.length} connections detected, ${fraudEdges.length} are fraud indicators. Average risk score is ${avgRiskScore}%. ${highRiskEntities.length} high-risk entities identified.`,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[AgentTool] Graph summary error:', error);
    return NextResponse.json(
      { error: 'Failed to get graph summary' },
      { status: 500 }
    );
  }
}
