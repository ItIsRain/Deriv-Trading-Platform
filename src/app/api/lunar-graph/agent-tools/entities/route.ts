// API Route: Agent Tool - Get Entity Details
// ElevenLabs agent calls this to get specific entity information

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
    const entityName = searchParams.get('name');

    const supabase = getSupabaseClient();

    // Get risk scores from latest graph snapshot
    const { data: snapshotData } = await supabase
      .from('graph_snapshots')
      .select('nodes')
      .order('created_at', { ascending: false })
      .limit(1);

    const graphNodes: Array<{ id: string; type: string; riskScore?: number }> = snapshotData?.[0]?.nodes || [];
    const riskScoreMap = new Map<string, number>();
    graphNodes.forEach(node => {
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    if (entityName) {
      // Search for specific entity by name (affiliates have name, clients have deriv_account_id)
      const searchTerm = `%${entityName}%`;

      const [affiliatesResult, clientsResult] = await Promise.all([
        supabase
          .from('affiliates')
          .select('id, name, email, referral_code, created_at')
          .ilike('name', searchTerm)
          .limit(5),
        supabase
          .from('clients')
          .select('id, deriv_account_id, affiliate_id, created_at')
          .ilike('deriv_account_id', searchTerm)
          .limit(5),
      ]);

      const results = [
        ...(affiliatesResult.data || []).map(a => ({ ...a, entityType: 'affiliate' as const })),
        ...(clientsResult.data || []).map(c => ({ ...c, name: c.deriv_account_id, entityType: 'client' as const })),
      ];

      return NextResponse.json({
        searchTerm: entityName,
        resultsFound: results.length,
        entities: results.map(e => ({
          type: e.entityType,
          name: e.name,
          email: 'email' in e ? e.email : undefined,
          riskScore: riskScoreMap.get(e.id) || 0,
          referralCode: 'referral_code' in e ? e.referral_code : undefined,
          createdAt: e.created_at,
        })),
      });
    }

    // Return high-risk entities from graph snapshot (since risk_score isn't in DB)
    const highRiskEntities = graphNodes
      .filter(n => (n.type === 'affiliate' || n.type === 'client') && (n.riskScore || 0) >= 50)
      .map(n => {
        const match = n.id.match(/^(affiliate|client)_(.+)$/);
        return {
          type: n.type,
          id: match ? match[2] : n.id,
          riskScore: n.riskScore || 0,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    // Fetch entity details for high-risk entities
    const affiliateIds = highRiskEntities.filter(e => e.type === 'affiliate').map(e => e.id);
    const clientIds = highRiskEntities.filter(e => e.type === 'client').map(e => e.id);

    const [affiliatesResult, clientsResult] = await Promise.all([
      affiliateIds.length > 0
        ? supabase.from('affiliates').select('id, name, email').in('id', affiliateIds)
        : { data: [] },
      clientIds.length > 0
        ? supabase.from('clients').select('id, deriv_account_id').in('id', clientIds)
        : { data: [] },
    ]);

    const entityDetails = new Map<string, { name: string; email?: string }>();
    (affiliatesResult.data || []).forEach(a => entityDetails.set(a.id, { name: a.name, email: a.email }));
    (clientsResult.data || []).forEach(c => entityDetails.set(c.id, { name: c.deriv_account_id || c.id }));

    return NextResponse.json({
      description: 'High risk entities (risk score >= 50)',
      totalHighRiskEntities: highRiskEntities.length,
      entities: highRiskEntities.slice(0, 15).map(e => {
        const details = entityDetails.get(e.id);
        return {
          type: e.type,
          name: details?.name || `Unknown ${e.type}`,
          email: details?.email,
          riskScore: e.riskScore,
        };
      }),
    });
  } catch (error) {
    console.error('[AgentTool] Entities error:', error);
    return NextResponse.json(
      { error: 'Failed to get entities' },
      { status: 500 }
    );
  }
}
