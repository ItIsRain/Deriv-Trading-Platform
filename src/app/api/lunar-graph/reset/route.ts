// API Route: Reset Investigation
// Clears all investigation data from the database

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function POST(): Promise<NextResponse> {
  try {
    console.log('[API] Resetting investigation data...');

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'Database not configured, nothing to reset',
      });
    }

    // Clear all investigation tables
    const results = await Promise.allSettled([
      db.from('lunar_alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('fraud_rings').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('agent_analysis_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('graph_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);

    // Check for errors
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason);

    if (errors.length > 0) {
      console.error('[API] Some tables failed to clear:', errors);
    }

    console.log('[API] Investigation data reset complete');

    return NextResponse.json({
      success: true,
      message: 'Investigation data cleared successfully',
    });
  } catch (error) {
    console.error('[API] Error resetting investigation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset investigation',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'Reset API is running' });
}
