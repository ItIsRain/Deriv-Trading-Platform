// API Route: Build Knowledge Graph
// Constructs the fraud detection graph from database and detects fraud rings

import { NextRequest, NextResponse } from 'next/server';
import { buildKnowledgeGraph } from '@/lib/lunar-graph/graph-builder';
import { detectAndSaveFraudRings, loadFraudRings } from '@/lib/lunar-graph/fraud-ring-detector';
import { BuildGraphResponse, FraudRing } from '@/types/lunar-graph';

export async function POST(request: NextRequest): Promise<NextResponse<BuildGraphResponse & { fraudRings?: FraudRing[] }>> {
  try {
    console.log('[API] Building knowledge graph...');

    // Build the graph
    const graph = await buildKnowledgeGraph();
    console.log(`[API] Graph built: ${graph.stats.totalNodes} nodes, ${graph.stats.totalEdges} edges`);

    // Detect fraud rings from the graph and save to database
    const detectedRings = await detectAndSaveFraudRings(graph);
    console.log(`[API] Detected ${detectedRings.length} fraud rings`);

    // Load all fraud rings from database (includes previously saved ones)
    const allRings = await loadFraudRings();
    console.log(`[API] Total fraud rings in database: ${allRings.length}`);

    return NextResponse.json({
      success: true,
      graph,
      fraudRings: allRings.length > 0 ? allRings : detectedRings,
    });
  } catch (error) {
    console.error('[API] Error building graph:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build graph',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'Build Graph API is running' });
}
