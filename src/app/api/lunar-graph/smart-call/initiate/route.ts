// API Route: Initiate Smart Call
// Initiates an outbound call via ElevenLabs Conversational AI with investigation context

import { NextRequest, NextResponse } from 'next/server';
import { createSmartCallClient } from '@/lib/lunar-graph/smart-call-client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface InitiateCallRequest {
  phoneNumber: string;
  context: {
    selectedEntities?: string[];
    fraudRingId?: string;
    graphSummary?: any;
    fraudRings?: any[];
    analysis?: any;
  };
}

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  try {
    const body: InitiateCallRequest = await request.json();
    const { phoneNumber, context } = body;

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    console.log('[SmartCall] Initiating call to:', normalizedPhone);
    console.log('[SmartCall] Config:', {
      agentId: process.env.ELEVENLABS_AGENT_ID?.slice(0, 10) + '...',
      phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID,
    });
    console.log('[SmartCall] Context:', {
      hasFraudRings: context.fraudRings?.length || 0,
      hasAnalysis: !!context.analysis,
      hasGraphSummary: !!context.graphSummary,
    });

    // Generate a unique call ID
    const callId = uuidv4();

    // Create the smart call client and initiate the call
    let smartCallClient;
    try {
      smartCallClient = createSmartCallClient();
    } catch (configError) {
      console.error('[SmartCall] Configuration error:', configError);
      return NextResponse.json(
        {
          success: false,
          error: configError instanceof Error ? configError.message : 'Smart call configuration error',
          callId,
          status: 'config_error',
        },
        { status: 500 }
      );
    }

    const result = await smartCallClient.initiateCall({
      phoneNumber: normalizedPhone,
      context,
    });

    if (!result.success) {
      console.error('[SmartCall] Failed to initiate:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to initiate call',
          callId,
          status: 'failed',
        },
        { status: 500 }
      );
    }

    // Store call record in Supabase
    try {
      const supabase = getSupabaseClient();
      await supabase.from('smart_calls').insert({
        id: callId,
        call_sid: result.callSid,
        phone_number: normalizedPhone,
        status: 'initiated',
        investigation_context: context,
        initiated_at: new Date().toISOString(),
      });
    } catch (dbError) {
      // Log but don't fail the request - the call was already initiated
      console.warn('[SmartCall] Failed to store call record:', dbError);
    }

    console.log('[SmartCall] Call initiated successfully:', {
      callId,
      callSid: result.callSid,
    });

    return NextResponse.json({
      success: true,
      callId,
      callSid: result.callSid,
      status: 'initiated',
      phoneNumber: normalizedPhone,
    });
  } catch (error) {
    console.error('[SmartCall] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate call',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Smart Call API is running',
    endpoints: {
      initiate: 'POST /api/lunar-graph/smart-call/initiate',
      status: 'GET /api/lunar-graph/smart-call/status?callId=...',
      webhook: 'POST /api/lunar-graph/smart-call/webhook',
    },
  });
}
