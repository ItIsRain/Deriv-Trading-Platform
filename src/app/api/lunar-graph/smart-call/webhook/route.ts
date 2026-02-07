// API Route: Smart Call Webhook
// Receives status updates from ElevenLabs about call progress

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

// Map call status to our internal status
function mapCallStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'initiated',
    'ringing': 'ringing',
    'in-progress': 'in-progress',
    'completed': 'completed',
    'busy': 'failed',
    'failed': 'failed',
    'no-answer': 'failed',
    'canceled': 'failed',
  };
  return statusMap[status] || status;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    // Parse the webhook payload
    let payload: Record<string, any>;
    try {
      // Try JSON parsing first
      payload = JSON.parse(body);
    } catch {
      // Fallback to form-urlencoded
      const params = new URLSearchParams(body);
      payload = Object.fromEntries(params.entries());
    }

    // Extract call information (handle both naming conventions)
    const callSid = payload.CallSid || payload.callSid || payload.call_sid;
    const callStatus = payload.CallStatus || payload.callStatus || payload.status;
    const callDuration = payload.CallDuration || payload.callDuration || payload.duration;
    const conversationId = payload.conversation_id || payload.conversationId;

    console.log('[SmartCall Webhook] Received:', {
      callSid,
      callStatus,
      callDuration,
      conversationId,
    });

    if (!callSid && !conversationId) {
      return NextResponse.json(
        { error: 'Missing call identifier' },
        { status: 400 }
      );
    }

    // Update call record in database
    try {
      const supabase = getSupabaseClient();
      const mappedStatus = mapCallStatus(callStatus);

      const updateData: Record<string, any> = {
        status: mappedStatus,
      };

      // Add timestamps based on status
      if (mappedStatus === 'in-progress') {
        updateData.started_at = new Date().toISOString();
      } else if (mappedStatus === 'completed' || mappedStatus === 'failed') {
        updateData.ended_at = new Date().toISOString();
        if (callDuration) {
          updateData.duration_seconds = parseInt(callDuration, 10);
        }
      }

      // Try to match by call_sid first, then by id (conversation_id)
      let updateError;
      if (callSid) {
        const result = await supabase
          .from('smart_calls')
          .update(updateData)
          .eq('call_sid', callSid);
        updateError = result.error;
      }

      if (updateError && conversationId) {
        const result = await supabase
          .from('smart_calls')
          .update(updateData)
          .eq('id', conversationId);
        updateError = result.error;
      }

      if (updateError) {
        console.warn('[SmartCall Webhook] Database update failed:', updateError);
      } else {
        console.log('[SmartCall Webhook] Updated call record:', callSid || conversationId, mappedStatus);
      }
    } catch (dbError) {
      console.error('[SmartCall Webhook] Database error:', dbError);
    }

    // Return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[SmartCall Webhook] Error:', error);
    // Return 200 anyway to prevent retries
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}

// Support GET for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'Smart Call Webhook is active',
    message: 'This endpoint receives ElevenLabs call status callbacks',
  });
}
