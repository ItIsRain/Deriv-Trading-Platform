// API Route: Agent Tool - Get Client Details
// Get full details about a specific client including their trades and connections
// Note: clients table has deriv_account_id (not name/email)

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
    const clientId = searchParams.get('id');
    const derivAccountId = searchParams.get('deriv_account_id') || searchParams.get('name');

    const supabase = getSupabaseClient();

    // Find client (clients table has deriv_account_id, not name/email)
    let query = supabase
      .from('clients')
      .select(`
        id,
        deriv_account_id,
        referral_code,
        ip_address,
        device_id,
        total_traded,
        total_pnl,
        created_at,
        affiliate_id,
        affiliates (
          id,
          name,
          email
        )
      `);

    if (clientId) {
      query = query.eq('id', clientId);
    } else if (derivAccountId) {
      query = query.ilike('deriv_account_id', `%${derivAccountId}%`);
    } else {
      return NextResponse.json({
        error: 'Please provide client id or deriv_account_id',
      }, { status: 400 });
    }

    const { data: clients, error } = await query.limit(5);

    if (error) {
      console.error('[AgentTool] Client query error:', error);
      return NextResponse.json({
        message: 'Error querying clients',
        error: error.message,
      }, { status: 500 });
    }

    if (!clients || clients.length === 0) {
      // If searching by name and no client found, check if it's an affiliate
      if (derivAccountId) {
        const { data: affiliates } = await supabase
          .from('affiliates')
          .select('id, name, email')
          .ilike('name', `%${derivAccountId}%`)
          .limit(1);

        if (affiliates && affiliates.length > 0) {
          return NextResponse.json({
            message: `"${derivAccountId}" is an affiliate, not a client. Use the /affiliate endpoint instead.`,
            foundAffiliate: {
              name: affiliates[0].name,
              email: affiliates[0].email,
            },
            hint: `Try: /api/lunar-graph/agent-tools/affiliate?name=${derivAccountId}`,
          });
        }
      }

      return NextResponse.json({
        message: 'No client found matching your criteria',
        searchedFor: { id: clientId, deriv_account_id: derivAccountId },
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

    // Get detailed info for each found client
    const clientDetails = await Promise.all(clients.map(async (client) => {
      const clientRiskScore = riskScoreMap.get(client.id) || 0;
      const affiliateRiskScore = client.affiliate_id ? (riskScoreMap.get(client.affiliate_id) || 0) : 0;

      // Get trades
      const { data: trades } = await supabase
        .from('trades')
        .select('id, contract_type, symbol, amount, profit, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const tradeList = trades || [];
      const totalVolume = tradeList.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalProfit = tradeList.reduce((sum, t) => sum + (t.profit || 0), 0);
      const profitableTrades = tradeList.filter(t => (t.profit || 0) > 0);

      // Check if in any fraud rings
      const { data: fraudRings } = await supabase
        .from('fraud_rings')
        .select('id, name, type, severity, exposure')
        .contains('entities', [client.id]);

      return {
        id: client.id,
        derivAccountId: client.deriv_account_id,
        referralCode: client.referral_code,
        ipAddress: client.ip_address,
        deviceId: client.device_id,
        riskScore: clientRiskScore,
        createdAt: client.created_at,

        affiliate: client.affiliates ? {
          name: (client.affiliates as any).name,
          email: (client.affiliates as any).email,
          riskScore: affiliateRiskScore,
        } : null,

        tradingActivity: {
          totalTrades: tradeList.length,
          totalVolume: Math.round(totalVolume * 100) / 100,
          totalProfit: Math.round(totalProfit * 100) / 100,
          storedTotalTraded: client.total_traded,
          storedTotalPnl: client.total_pnl,
          winRate: tradeList.length > 0
            ? Math.round((profitableTrades.length / tradeList.length) * 100)
            : 0,
          callTrades: tradeList.filter(t => t.contract_type === 'CALL').length,
          putTrades: tradeList.filter(t => t.contract_type === 'PUT').length,
          recentTrades: tradeList.slice(0, 10).map(t => ({
            type: t.contract_type,
            symbol: t.symbol,
            amount: t.amount,
            profit: t.profit,
          })),
        },

        fraudRingInvolvement: (fraudRings || []).map(r => ({
          ringName: r.name,
          type: r.type?.replace(/_/g, ' '),
          severity: r.severity,
          exposure: r.exposure,
        })),

        riskAssessment: {
          isHighRisk: clientRiskScore >= 50,
          inFraudRing: (fraudRings || []).length > 0,
          hasSuspiciousPattern: (fraudRings || []).some(r =>
            r.type === 'opposite_trading' || r.type === 'timing_coordination'
          ),
        },
      };
    }));

    return NextResponse.json({
      resultsFound: clientDetails.length,
      clients: clientDetails,
    });
  } catch (error) {
    console.error('[AgentTool] Client error:', error);
    return NextResponse.json(
      { error: 'Failed to get client details' },
      { status: 500 }
    );
  }
}
