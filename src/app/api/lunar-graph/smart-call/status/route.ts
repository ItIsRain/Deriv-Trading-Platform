// API Route: Smart Call Status
// Check the status of an initiated call

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSmartCallClient } from '@/lib/lunar-graph/smart-call-client';

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get('callId');

    if (!callId) {
      return NextResponse.json(
        { success: false, error: 'callId is required' },
        { status: 400 }
      );
    }

    // First, try to get from database
    try {
      const supabase = getSupabaseClient();
      const { data: callRecord, error: dbError } = await supabase
        .from('smart_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (callRecord && !dbError) {
        return NextResponse.json({
          success: true,
          call: {
            id: callRecord.id,
            callSid: callRecord.call_sid,
            phoneNumber: callRecord.phone_number,
            status: callRecord.status,
            duration: callRecord.duration_seconds,
            initiatedAt: callRecord.initiated_at,
            startedAt: callRecord.started_at,
            endedAt: callRecord.ended_at,
          },
        });
      }
    } catch (dbError) {
      console.warn('[SmartCall Status] Database lookup failed:', dbError);
    }

    // If not in database, try to get from ElevenLabs directly
    try {
      const smartCallClient = createSmartCallClient();
      const elevenLabsStatus = await smartCallClient.getCallStatus(callId);

      return NextResponse.json({
        success: true,
        call: {
          id: callId,
          status: elevenLabsStatus.status,
          duration: elevenLabsStatus.duration,
        },
      });
    } catch (apiError) {
      console.warn('[SmartCall Status] ElevenLabs lookup failed:', apiError);
    }

    // Call not found
    return NextResponse.json(
      { success: false, error: 'Call not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[SmartCall Status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get call status',
      },
      { status: 500 }
    );
  }
}
