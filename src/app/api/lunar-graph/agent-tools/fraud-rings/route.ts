// API Route: Agent Tool - Get Fraud Rings
// ElevenLabs agent calls this to get detected fraud rings

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

    // Get fraud rings from database
    const { data: fraudRings, error } = await supabase
      .from('fraud_rings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AgentTool] Fraud rings query error:', error);
    }

    // Format for voice conversation
    const rings = (fraudRings || []).map(ring => ({
      name: ring.name,
      type: ring.type?.replace(/_/g, ' '),
      severity: ring.severity,
      confidence: ring.confidence,
      entityCount: ring.entities?.length || 0,
      financialExposure: ring.exposure,
      summary: ring.ai_summary,
      status: ring.status,
    }));

    // Summary stats
    const criticalCount = rings.filter(r => r.severity === 'critical').length;
    const highCount = rings.filter(r => r.severity === 'high').length;
    const totalExposure = rings.reduce((sum, r) => sum + (r.financialExposure || 0), 0);

    return NextResponse.json({
      totalFraudRings: rings.length,
      criticalSeverityCount: criticalCount,
      highSeverityCount: highCount,
      totalFinancialExposure: totalExposure,
      fraudRings: rings,
    });
  } catch (error) {
    console.error('[AgentTool] Fraud rings error:', error);
    return NextResponse.json(
      { error: 'Failed to get fraud rings' },
      { status: 500 }
    );
  }
}
