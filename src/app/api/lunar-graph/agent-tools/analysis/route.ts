// API Route: Agent Tool - Get Full Analysis
// ElevenLabs agent calls this to get complete investigation analysis

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
    const [
      affiliatesResult,
      clientsResult,
      tradesResult,
      fraudRingsResult,
      alertsResult,
      graphSnapshotResult,
    ] = await Promise.all([
      supabase.from('affiliates').select('id, name'),
      supabase.from('clients').select('id, deriv_account_id, affiliate_id'),
      supabase.from('trades').select('id, contract_type, amount, profit'),
      supabase.from('fraud_rings').select('*').order('created_at', { ascending: false }),
      supabase.from('lunar_alerts').select('*').eq('acknowledged', false),
      supabase.from('graph_snapshots').select('*').order('created_at', { ascending: false }).limit(1),
    ]);

    const affiliates = affiliatesResult.data || [];
    const clients = clientsResult.data || [];
    const trades = tradesResult.data || [];
    const fraudRings = fraudRingsResult.data || [];
    const alerts = alertsResult.data || [];
    const latestSnapshot = graphSnapshotResult.data?.[0];

    // Extract edges and nodes from the latest graph snapshot
    const edges: Array<{ type?: string; is_fraud_indicator?: boolean }> = latestSnapshot?.edges || [];
    const graphNodes: Array<{ id: string; type: string; label: string; riskScore?: number }> = latestSnapshot?.nodes || [];

    // Build risk score map from graph nodes
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Calculate overall risk score from graph nodes (more accurate)
    const entityRiskScores = graphNodes
      .filter(n => n.type === 'affiliate' || n.type === 'client')
      .map(n => n.riskScore || 0);
    const avgRiskScore = entityRiskScores.length > 0
      ? Math.round(entityRiskScores.reduce((a, b) => a + b, 0) / entityRiskScores.length)
      : 0;

    // High risk counts (use graph nodes for accurate risk scores)
    // Clients inherit their affiliate's risk score since clients aren't in the graph
    const highRiskAffiliates = affiliates.filter(a => (riskScoreMap.get(a.id) || 0) >= 50);
    const highRiskClients = clients.filter(c => {
      const affiliateRisk = c.affiliate_id ? (riskScoreMap.get(c.affiliate_id) || 0) : 0;
      return affiliateRisk >= 50;
    });

    // Trade stats
    const totalTradeVolume = trades.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);

    // Edge/Connection stats
    const fraudEdges = edges.filter(e => e.is_fraud_indicator);
    const edgesByType: Record<string, number> = {};
    edges.forEach(e => {
      const type = e.type || 'unknown';
      edgesByType[type] = (edgesByType[type] || 0) + 1;
    });

    // Fraud ring summary
    const criticalRings = fraudRings.filter(r => r.severity === 'critical');
    const highRings = fraudRings.filter(r => r.severity === 'high');
    const totalExposure = fraudRings.reduce((sum, r) => sum + (r.exposure || 0), 0);

    // Alert summary
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const highAlerts = alerts.filter(a => a.severity === 'high');

    return NextResponse.json({
      overallRiskScore: avgRiskScore,
      summary: `Investigation shows ${fraudRings.length} fraud rings with $${totalExposure.toFixed(2)} total exposure. ${criticalRings.length} critical and ${highRings.length} high severity issues. ${fraudEdges.length} fraud indicator connections detected.`,

      graphStats: {
        totalNodes: affiliates.length + clients.length + trades.length,
        totalAffiliates: affiliates.length,
        totalClients: clients.length,
        totalTrades: trades.length,
        totalEdges: edges.length,
        fraudEdges: fraudEdges.length,
        averageRiskScore: avgRiskScore,
      },

      connectionStats: {
        totalConnections: edges.length,
        fraudIndicatorConnections: fraudEdges.length,
        connectionsByType: Object.entries(edgesByType).map(([type, count]) => ({
          type: type.replace(/_/g, ' '),
          count,
          fraudCount: edges.filter(e => e.type === type && e.is_fraud_indicator).length,
        })),
      },

      entityStats: {
        totalAffiliates: affiliates.length,
        totalClients: clients.length,
        highRiskAffiliates: highRiskAffiliates.length,
        highRiskClients: highRiskClients.length,
        totalHighRiskEntities: highRiskAffiliates.length + highRiskClients.length,
        topHighRiskEntities: [
          ...highRiskAffiliates.map(a => ({ name: a.name, type: 'affiliate', riskScore: riskScoreMap.get(a.id) || 0 })),
          ...highRiskClients.map(c => ({ name: c.deriv_account_id || c.id, type: 'client', riskScore: c.affiliate_id ? (riskScoreMap.get(c.affiliate_id) || 0) : 0 })),
        ]
          .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
          .slice(0, 10),
      },

      tradeStats: {
        totalTrades: trades.length,
        totalVolume: Math.round(totalTradeVolume * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        callTrades: trades.filter(t => t.contract_type === 'CALL').length,
        putTrades: trades.filter(t => t.contract_type === 'PUT').length,
      },

      fraudRingStats: {
        totalFraudRings: fraudRings.length,
        criticalCount: criticalRings.length,
        highCount: highRings.length,
        totalExposure: Math.round(totalExposure * 100) / 100,
        topFraudRings: fraudRings.slice(0, 5).map(r => ({
          name: r.name,
          type: r.type?.replace(/_/g, ' '),
          severity: r.severity,
          confidence: r.confidence,
          exposure: r.exposure,
          entityCount: r.entities?.length || 0,
          summary: r.ai_summary,
        })),
      },

      alertStats: {
        totalActiveAlerts: alerts.length,
        criticalAlerts: criticalAlerts.length,
        highAlerts: highAlerts.length,
        topAlerts: alerts.slice(0, 5).map(a => ({
          severity: a.severity,
          title: a.title,
          description: a.description,
          type: a.type,
        })),
      },

      investigationPriorities: [
        ...(criticalRings.length > 0 ? [`Address ${criticalRings.length} critical fraud rings immediately`] : []),
        ...(criticalAlerts.length > 0 ? [`Review ${criticalAlerts.length} critical alerts`] : []),
        ...(fraudEdges.length > 0 ? [`Investigate ${fraudEdges.length} fraud indicator connections`] : []),
        ...(highRiskAffiliates.length > 0 ? [`Investigate ${highRiskAffiliates.length} high-risk affiliates`] : []),
        ...(highRiskClients.length > 0 ? [`Monitor ${highRiskClients.length} high-risk clients`] : []),
      ],
    });
  } catch (error) {
    console.error('[AgentTool] Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis' },
      { status: 500 }
    );
  }
}
