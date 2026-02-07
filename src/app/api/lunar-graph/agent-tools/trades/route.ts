// API Route: Agent Tool - Get Trades (Flexible)
// Supports filtering by client, affiliate, symbol, date range, etc.

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

    // Filter parameters
    const clientId = searchParams.get('client_id');
    const clientName = searchParams.get('client_name');
    const affiliateId = searchParams.get('affiliate_id');
    const affiliateName = searchParams.get('affiliate_name');
    const symbol = searchParams.get('symbol');
    const contractType = searchParams.get('type'); // CALL or PUT
    const minAmount = searchParams.get('min_amount');
    const maxAmount = searchParams.get('max_amount');
    const limit = parseInt(searchParams.get('limit') || '100');

    const supabase = getSupabaseClient();

    // If searching by client name, first find the client
    // If no client found, check if it's an affiliate name and get their clients' trades
    let resolvedClientId = clientId;
    let foundAsAffiliate = false;
    let affiliateClientIds: string[] = [];

    if (clientName && !clientId) {
      // Note: clients table doesn't have 'name' column - use deriv_account_id
      const { data: clients } = await supabase
        .from('clients')
        .select('id, deriv_account_id')
        .ilike('deriv_account_id', `%${clientName}%`)
        .limit(1);

      if (clients && clients.length > 0) {
        resolvedClientId = clients[0].id;
      } else {
        // No client found - check if it's an affiliate name
        const { data: affiliates } = await supabase
          .from('affiliates')
          .select('id, name')
          .ilike('name', `%${clientName}%`)
          .limit(1);

        if (affiliates && affiliates.length > 0) {
          foundAsAffiliate = true;
          const affId = affiliates[0].id;

          // Get all clients under this affiliate
          const { data: affClients } = await supabase
            .from('clients')
            .select('id')
            .eq('affiliate_id', affId);

          affiliateClientIds = (affClients || []).map(c => c.id);

          if (affiliateClientIds.length === 0) {
            return NextResponse.json({
              message: `Found affiliate "${affiliates[0].name}" but they have no clients with trades`,
              trades: [],
              totalTrades: 0,
            });
          }
        } else {
          return NextResponse.json({
            message: `No client or affiliate found matching "${clientName}"`,
            trades: [],
            totalTrades: 0,
          });
        }
      }
    }

    // If searching by affiliate name, find their clients' trades
    if ((affiliateName || affiliateId) && !foundAsAffiliate) {
      let affId = affiliateId;

      if (affiliateName && !affiliateId) {
        const { data: affiliates } = await supabase
          .from('affiliates')
          .select('id, name')
          .ilike('name', `%${affiliateName}%`)
          .limit(1);

        if (affiliates && affiliates.length > 0) {
          affId = affiliates[0].id;
        } else {
          return NextResponse.json({
            message: `No affiliate found matching "${affiliateName}"`,
            trades: [],
            totalTrades: 0,
          });
        }
      }

      // Get all clients under this affiliate
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('affiliate_id', affId);

      affiliateClientIds = (clients || []).map(c => c.id);
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

    // Build query (note: clients table has deriv_account_id, not name/email)
    let query = supabase
      .from('trades')
      .select(`
        id,
        contract_type,
        symbol,
        amount,
        profit,
        created_at,
        client_id,
        clients!inner (
          id,
          deriv_account_id,
          affiliate_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (resolvedClientId) {
      query = query.eq('client_id', resolvedClientId);
    }

    if (affiliateClientIds.length > 0) {
      query = query.in('client_id', affiliateClientIds);
    }

    if (symbol) {
      query = query.ilike('symbol', `%${symbol}%`);
    }

    if (contractType) {
      query = query.eq('contract_type', contractType.toUpperCase());
    }

    if (minAmount) {
      query = query.gte('amount', parseFloat(minAmount));
    }

    if (maxAmount) {
      query = query.lte('amount', parseFloat(maxAmount));
    }

    const { data: trades, error } = await query;

    if (error) {
      console.error('[AgentTool] Trades query error:', error);
    }

    // Calculate stats
    const tradeList = trades || [];
    const totalAmount = tradeList.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalProfit = tradeList.reduce((sum, t) => sum + (t.profit || 0), 0);
    const callTrades = tradeList.filter(t => t.contract_type === 'CALL');
    const putTrades = tradeList.filter(t => t.contract_type === 'PUT');
    const profitableTrades = tradeList.filter(t => (t.profit || 0) > 0);
    const losingTrades = tradeList.filter(t => (t.profit || 0) < 0);

    // Get unique clients
    const uniqueClients = new Map();
    tradeList.forEach(t => {
      if (t.clients && !uniqueClients.has(t.client_id)) {
        uniqueClients.set(t.client_id, t.clients);
      }
    });

    return NextResponse.json({
      totalTrades: tradeList.length,
      totalVolume: Math.round(totalAmount * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profitableTrades: profitableTrades.length,
      losingTrades: losingTrades.length,
      winRate: tradeList.length > 0
        ? Math.round((profitableTrades.length / tradeList.length) * 100)
        : 0,
      callTrades: callTrades.length,
      putTrades: putTrades.length,
      uniqueClients: uniqueClients.size,

      // Filters applied
      filters: {
        clientName: clientName || null,
        affiliateName: affiliateName || null,
        symbol: symbol || null,
        type: contractType || null,
        ...(foundAsAffiliate ? { note: `"${clientName}" matched an affiliate, showing trades from their clients` } : {}),
      },

      // Trade list
      trades: tradeList.slice(0, 30).map(t => {
        const clientData = t.clients as any;
        // Use client's affiliate risk score (since clients aren't in the graph)
        const affiliateId = clientData?.affiliate_id;
        const riskScore = affiliateId ? (riskScoreMap.get(affiliateId) || 0) : 0;
        return {
          type: t.contract_type,
          symbol: t.symbol,
          amount: t.amount,
          profit: t.profit,
          clientId: clientData?.deriv_account_id || t.client_id,
          clientRiskScore: riskScore,
          affiliateRiskScore: riskScore,
          timestamp: t.created_at,
        };
      }),
    });
  } catch (error) {
    console.error('[AgentTool] Trades error:', error);
    return NextResponse.json(
      { error: 'Failed to get trades' },
      { status: 500 }
    );
  }
}
