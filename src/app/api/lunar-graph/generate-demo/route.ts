// API Route: Generate Demo Data
// Creates synthetic fraud scenarios for demonstration

import { NextRequest, NextResponse } from 'next/server';
import { generateDemoData, DEMO_SCENARIOS } from '@/lib/lunar-graph/demo-data-generator';
import { GenerateDemoResponse, FraudRingType } from '@/types/lunar-graph';
import { isSupabaseConfigured } from '@/lib/supabase';

interface GenerateDemoRequest {
  scenarioType?: FraudRingType;
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateDemoResponse>> {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase not configured. Demo data requires a database connection.',
        },
        { status: 400 }
      );
    }

    const body: GenerateDemoRequest = await request.json().catch(() => ({}));
    const { scenarioType } = body;

    console.log('[API] Generating demo data, scenario:', scenarioType || 'random');

    const result = await generateDemoData(scenarioType);

    console.log(`[API] Demo data generated: ${result.entitiesCreated.affiliates} affiliates, ${result.entitiesCreated.clients} clients, ${result.entitiesCreated.trades} trades`);

    return NextResponse.json({
      success: true,
      scenario: result.scenario,
      entitiesCreated: result.entitiesCreated,
    });
  } catch (error) {
    console.error('[API] Error generating demo data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate demo data',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'Demo Data API is running',
    availableScenarios: DEMO_SCENARIOS.map(s => ({
      type: s.type,
      name: s.name,
      description: s.description,
    })),
  });
}
