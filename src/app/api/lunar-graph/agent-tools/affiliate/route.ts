// API Route: Agent Tool - Get Affiliate Details
// Get full details about an affiliate including their clients and performance

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
    const affiliateId = searchParams.get('id');
    const affiliateName = searchParams.get('name');
    const affiliateEmail = searchParams.get('email');

    const supabase = getSupabaseClient();

    // Find affiliate
    let query = supabase
      .from('affiliates')
      .select('id, name, email, referral_code, created_at');

    if (affiliateId) {
      query = query.eq('id', affiliateId);
    } else if (affiliateEmail) {
      query = query.ilike('email', `%${affiliateEmail}%`);
    } else if (affiliateName) {
      query = query.ilike('name', `%${affiliateName}%`);
    } else {
      return NextResponse.json({
        error: 'Please provide affiliate id, name, or email',
      }, { status: 400 });
    }

    const { data: affiliates, error } = await query.limit(5);

    if (error) {
      console.error('[AgentTool] Affiliate query error:', error);
      return NextResponse.json({
        message: 'Error querying affiliates',
        error: error.message,
      }, { status: 500 });
    }

    if (!affiliates || affiliates.length === 0) {
      return NextResponse.json({
        message: 'No affiliate found matching your criteria',
        searchedFor: { id: affiliateId, name: affiliateName, email: affiliateEmail },
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
      // Extract entity ID from node ID (e.g., "affiliate_uuid" -> "uuid")
      const match = node.id.match(/^(affiliate|client)_(.+)$/);
      if (match) {
        riskScoreMap.set(match[2], node.riskScore || 0);
      }
    });

    // Get detailed info for each found affiliate
    const affiliateDetails = await Promise.all(affiliates.map(async (affiliate) => {
      const affiliateRiskScore = riskScoreMap.get(affiliate.id) || 0;

      // Get clients (clients table has deriv_account_id, not name/email)
      const { data: clients } = await supabase
        .from('clients')
        .select('id, deriv_account_id, created_at')
        .eq('affiliate_id', affiliate.id);

      const clientList = (clients || []).map(c => ({
        ...c,
        name: c.deriv_account_id, // Map for consistent response
        riskScore: riskScoreMap.get(c.id) || 0,
      }));
      const highRiskClients = clientList.filter(c => c.riskScore >= 50);

      // Get all trades from these clients
      const clientIds = clientList.map(c => c.id);
      let totalTrades = 0;
      let totalVolume = 0;
      let totalProfit = 0;

      if (clientIds.length > 0) {
        const { data: trades } = await supabase
          .from('trades')
          .select('amount, profit')
          .in('client_id', clientIds);

        const tradeList = trades || [];
        totalTrades = tradeList.length;
        totalVolume = tradeList.reduce((sum, t) => sum + (t.amount || 0), 0);
        totalProfit = tradeList.reduce((sum, t) => sum + (t.profit || 0), 0);
      }

      // Check if in any fraud rings
      const { data: fraudRings } = await supabase
        .from('fraud_rings')
        .select('id, name, type, severity, exposure')
        .contains('entities', [affiliate.id]);

      return {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        riskScore: affiliateRiskScore,
        referralCode: affiliate.referral_code,
        createdAt: affiliate.created_at,

        clientNetwork: {
          totalClients: clientList.length,
          highRiskClients: highRiskClients.length,
          averageClientRiskScore: clientList.length > 0
            ? Math.round(clientList.reduce((sum, c) => sum + c.riskScore, 0) / clientList.length)
            : 0,
          clients: clientList.slice(0, 10).map(c => ({
            name: c.name,
            derivAccountId: c.deriv_account_id,
            riskScore: c.riskScore,
          })),
        },

        tradingPerformance: {
          totalTrades,
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalProfit: Math.round(totalProfit * 100) / 100,
          averageTradeSize: totalTrades > 0
            ? Math.round((totalVolume / totalTrades) * 100) / 100
            : 0,
        },

        fraudRingInvolvement: (fraudRings || []).map(r => ({
          ringName: r.name,
          type: r.type?.replace(/_/g, ' '),
          severity: r.severity,
          exposure: r.exposure,
        })),

        riskAssessment: {
          isHighRisk: affiliateRiskScore >= 50,
          inFraudRing: (fraudRings || []).length > 0,
          hasHighRiskClients: highRiskClients.length > 0,
          riskFactors: [
            ...(affiliateRiskScore >= 50 ? ['High personal risk score'] : []),
            ...((fraudRings?.length ?? 0) > 0 ? ['Involved in fraud ring'] : []),
            ...(highRiskClients.length > 0 ? [`${highRiskClients.length} high-risk clients`] : []),
          ],
        },
      };
    }));

    return NextResponse.json({
      resultsFound: affiliateDetails.length,
      affiliates: affiliateDetails,
    });
  } catch (error) {
    console.error('[AgentTool] Affiliate error:', error);
    return NextResponse.json(
      { error: 'Failed to get affiliate details' },
      { status: 500 }
    );
  }
}
