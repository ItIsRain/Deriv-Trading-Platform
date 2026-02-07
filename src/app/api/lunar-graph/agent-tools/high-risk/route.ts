// API Route: Agent Tool - Get High Risk Entities
// Get all entities above a certain risk threshold (from graph snapshot)

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
    const minRisk = parseInt(searchParams.get('min_risk') || '50');
    const entityType = searchParams.get('type'); // 'affiliate', 'client', or 'all'
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = getSupabaseClient();

    // Get risk scores from latest graph snapshot (risk_score is not stored in DB tables)
    const { data: snapshotData } = await supabase
      .from('graph_snapshots')
      .select('nodes')
      .order('created_at', { ascending: false })
      .limit(1);

    const graphNodes: Array<{ id: string; type: string; label: string; riskScore?: number }> = snapshotData?.[0]?.nodes || [];

    // Filter and transform high-risk entities from graph
    const highRiskFromGraph = graphNodes
      .filter(node => {
        const isValidType = node.type === 'affiliate' || node.type === 'client';
        const matchesFilter = !entityType || entityType === 'all' || node.type === entityType;
        const isHighRisk = (node.riskScore || 0) >= minRisk;
        return isValidType && matchesFilter && isHighRisk;
      })
      .map(node => {
        const match = node.id.match(/^(affiliate|client)_(.+)$/);
        return {
          id: match ? match[2] : node.id,
          entityType: node.type,
          riskScore: node.riskScore || 0,
          label: node.label,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // Get entity details from database
    const affiliateIds = highRiskFromGraph.filter(e => e.entityType === 'affiliate').map(e => e.id);
    const clientIds = highRiskFromGraph.filter(e => e.entityType === 'client').map(e => e.id);

    const [affiliatesResult, clientsResult] = await Promise.all([
      affiliateIds.length > 0
        ? supabase.from('affiliates').select('id, name, email, referral_code, created_at').in('id', affiliateIds)
        : { data: [] },
      clientIds.length > 0
        ? supabase.from('clients').select('id, deriv_account_id, affiliate_id, created_at').in('id', clientIds)
        : { data: [] },
    ]);

    const entityDetails = new Map<string, any>();
    (affiliatesResult.data || []).forEach(a => entityDetails.set(a.id, { ...a, entityType: 'affiliate' }));
    (clientsResult.data || []).forEach(c => entityDetails.set(c.id, { ...c, entityType: 'client' }));

    // Merge graph risk data with entity details
    const results = highRiskFromGraph.map(graphEntity => {
      const details = entityDetails.get(graphEntity.id);
      // Affiliates have name/email, clients have deriv_account_id
      const displayName = details?.name || details?.deriv_account_id || graphEntity.label;
      return {
        id: graphEntity.id,
        entityType: graphEntity.entityType,
        name: displayName,
        email: details?.email, // Only affiliates have email
        risk_score: graphEntity.riskScore,
        referral_code: details?.referral_code,
        created_at: details?.created_at,
      };
    });

    // Get fraud ring involvement for top entities
    const topEntityIds = results.slice(0, 20).map(e => e.id);
    const { data: fraudRings } = await supabase
      .from('fraud_rings')
      .select('id, name, entities, severity');

    const entityFraudRings = new Map<string, any[]>();
    (fraudRings || []).forEach(ring => {
      (ring.entities || []).forEach((entityId: string) => {
        if (!entityFraudRings.has(entityId)) {
          entityFraudRings.set(entityId, []);
        }
        entityFraudRings.get(entityId)!.push({
          name: ring.name,
          severity: ring.severity,
        });
      });
    });

    // Risk distribution
    const criticalRisk = results.filter(e => e.risk_score >= 80);
    const highRisk = results.filter(e => e.risk_score >= 60 && e.risk_score < 80);
    const mediumRisk = results.filter(e => e.risk_score >= minRisk && e.risk_score < 60);

    return NextResponse.json({
      totalHighRiskEntities: results.length,
      minRiskThreshold: minRisk,

      riskDistribution: {
        critical: criticalRisk.length,
        high: highRisk.length,
        medium: mediumRisk.length,
      },

      byEntityType: {
        affiliates: results.filter(e => e.entityType === 'affiliate').length,
        clients: results.filter(e => e.entityType === 'client').length,
      },

      entities: results.slice(0, limit).map(e => ({
        type: e.entityType,
        name: e.name,
        email: e.email,
        riskScore: e.risk_score,
        riskLevel: e.risk_score >= 80 ? 'critical' : e.risk_score >= 60 ? 'high' : 'medium',
        fraudRings: entityFraudRings.get(e.id) || [],
        inFraudRing: entityFraudRings.has(e.id),
        createdAt: e.created_at,
      })),

      recommendations: [
        ...(criticalRisk.length > 0 ? [`Review ${criticalRisk.length} critical risk entities immediately`] : []),
        ...(highRisk.length > 0 ? [`Investigate ${highRisk.length} high risk entities`] : []),
        ...([...entityFraudRings.keys()].length > 0 ? [`${[...entityFraudRings.keys()].length} entities are involved in fraud rings`] : []),
      ],
    });
  } catch (error) {
    console.error('[AgentTool] High risk error:', error);
    return NextResponse.json(
      { error: 'Failed to get high risk entities' },
      { status: 500 }
    );
  }
}
