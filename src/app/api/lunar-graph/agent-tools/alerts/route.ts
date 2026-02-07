// API Route: Agent Tool - Get Alerts
// ElevenLabs agent calls this to get active alerts

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

    // Get alerts from database
    const { data: alerts, error } = await supabase
      .from('lunar_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[AgentTool] Alerts query error:', error);
    }

    // Count by severity
    const criticalAlerts = (alerts || []).filter(a => a.severity === 'critical');
    const highAlerts = (alerts || []).filter(a => a.severity === 'high');
    const mediumAlerts = (alerts || []).filter(a => a.severity === 'medium');

    return NextResponse.json({
      totalActiveAlerts: alerts?.length || 0,
      criticalCount: criticalAlerts.length,
      highCount: highAlerts.length,
      mediumCount: mediumAlerts.length,
      alerts: (alerts || []).slice(0, 15).map(a => ({
        severity: a.severity,
        title: a.title,
        description: a.description,
        type: a.type,
        createdAt: a.created_at,
      })),
    });
  } catch (error) {
    console.error('[AgentTool] Alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to get alerts' },
      { status: 500 }
    );
  }
}
