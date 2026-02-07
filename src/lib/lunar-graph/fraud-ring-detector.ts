// Fraud Ring Detector
// Detects fraud rings from knowledge graph and manages database operations

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  KnowledgeGraph,
  FraudRing,
  FraudSeverity,
} from '@/types/lunar-graph';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Cluster {
  id: string;
  nodes: string[];
  avgRiskScore: number;
  fraudEdgeCount: number;
  density: number;
}

// ============ COMMUNITY DETECTION ============

function detectCommunities(graph: KnowledgeGraph): Cluster[] {
  const clusters: Cluster[] = [];
  const visited = new Set<string>();

  // Build adjacency map for fraud-related edges only
  const adjacency: Record<string, Set<string>> = {};
  for (const edge of graph.edges) {
    if (edge.isFraudIndicator || edge.type === 'device_match' || edge.type === 'ip_overlap') {
      if (!adjacency[edge.source]) adjacency[edge.source] = new Set();
      if (!adjacency[edge.target]) adjacency[edge.target] = new Set();
      adjacency[edge.source].add(edge.target);
      adjacency[edge.target].add(edge.source);
    }
  }

  // BFS to find connected components
  for (const startNode of Object.keys(adjacency)) {
    if (visited.has(startNode)) continue;

    const component: string[] = [];
    const queue = [startNode];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;

      visited.add(node);
      component.push(node);

      const neighbors = adjacency[node] || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    if (component.length >= 2) {
      const clusterNodes = graph.nodes.filter(n => component.includes(n.id));
      const avgRiskScore = clusterNodes.length > 0
        ? clusterNodes.reduce((sum, n) => sum + n.riskScore, 0) / clusterNodes.length
        : 0;

      const clusterEdges = graph.edges.filter(
        e => component.includes(e.source) && component.includes(e.target)
      );
      const fraudEdgeCount = clusterEdges.filter(e => e.isFraudIndicator).length;

      const possibleEdges = (component.length * (component.length - 1)) / 2;
      const density = possibleEdges > 0 ? clusterEdges.length / possibleEdges : 0;

      clusters.push({
        id: uuidv4(),
        nodes: component,
        avgRiskScore,
        fraudEdgeCount,
        density,
      });
    }
  }

  return clusters.sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

// ============ FRAUD RING EXTRACTION ============

function getSeverity(score: number): FraudSeverity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function extractFraudRings(
  clusters: Cluster[],
  graph: KnowledgeGraph
): FraudRing[] {
  const rings: FraudRing[] = [];

  // Lower threshold to detect more rings: avgRiskScore >= 30 OR fraudEdgeCount >= 1
  for (const cluster of clusters.filter(c => c.avgRiskScore >= 30 || c.fraudEdgeCount >= 1)) {
    const clusterEdges = graph.edges.filter(
      e => cluster.nodes.includes(e.source) || cluster.nodes.includes(e.target)
    );

    const hasOpposite = clusterEdges.some(e => e.type === 'opposite_position');
    const hasDevice = clusterEdges.some(e => e.type === 'device_match');
    const hasIP = clusterEdges.some(e => e.type === 'ip_overlap');
    const hasTiming = clusterEdges.some(e => e.type === 'timing_sync');

    let ringType: FraudRing['type'] = 'timing_coordination';
    if (hasOpposite) ringType = 'opposite_trading';
    else if (hasDevice) ringType = 'multi_account';
    else if (hasIP) ringType = 'ip_clustering';

    // Calculate exposure from trade amounts
    const tradeNodes = cluster.nodes.filter(id => id.startsWith('trade_'));
    const exposure = tradeNodes.reduce((sum, id) => {
      const node = graph.nodes.find(n => n.id === id);
      return sum + (node?.metadata.amount || 0);
    }, 0);

    const ringName = `${ringType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Ring`;

    rings.push({
      id: uuidv4(),
      name: ringName,
      type: ringType,
      severity: getSeverity(cluster.avgRiskScore),
      confidence: Math.min(95, 40 + cluster.fraudEdgeCount * 15),
      entities: cluster.nodes,
      exposure,
      evidence: clusterEdges
        .filter(e => e.isFraudIndicator || e.type === 'device_match' || e.type === 'ip_overlap')
        .slice(0, 10)
        .map(e => ({
          type: e.type,
          description: e.metadata.description || `${e.type.replace(/_/g, ' ')} connection`,
          confidence: e.metadata.confidence || 50,
          sourceNodes: [e.source, e.target],
          sourceEdges: [e.id],
          timestamp: e.metadata.detectedAt || new Date().toISOString(),
        })),
      aiSummary: `Detected ${ringType.replace(/_/g, ' ')} pattern involving ${cluster.nodes.length} entities with ${cluster.fraudEdgeCount} suspicious connections. Average risk score: ${Math.round(cluster.avgRiskScore)}%.`,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }

  return rings;
}

// ============ DATABASE OPERATIONS ============

async function saveFraudRing(ring: FraudRing): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    // Check if a similar ring already exists (same entities)
    const { data: existing } = await db
      .from('fraud_rings')
      .select('id')
      .contains('entities', ring.entities.slice(0, 3))
      .eq('status', 'active')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[FraudRingDetector] Ring already exists, skipping: ${ring.name}`);
      return false;
    }

    await db.from('fraud_rings').insert({
      id: ring.id,
      name: ring.name,
      type: ring.type,
      severity: ring.severity,
      confidence: ring.confidence,
      entities: ring.entities,
      exposure: ring.exposure,
      evidence: ring.evidence,
      ai_summary: ring.aiSummary,
      status: ring.status,
    });

    console.log(`[FraudRingDetector] Saved fraud ring: ${ring.name}`);
    return true;
  } catch (error) {
    console.error('[FraudRingDetector] Error saving fraud ring:', error);
    return false;
  }
}

export async function loadFraudRings(): Promise<FraudRing[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await db
      .from('fraud_rings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[FraudRingDetector] Error loading fraud rings:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      severity: row.severity,
      confidence: row.confidence,
      entities: row.entities || [],
      exposure: row.exposure || 0,
      evidence: row.evidence || [],
      aiSummary: row.ai_summary || '',
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('[FraudRingDetector] Error loading fraud rings:', error);
    return [];
  }
}

export async function detectAndSaveFraudRings(graph: KnowledgeGraph): Promise<FraudRing[]> {
  console.log('[FraudRingDetector] Detecting fraud rings...');

  // Detect communities in the graph
  const clusters = detectCommunities(graph);
  console.log(`[FraudRingDetector] Found ${clusters.length} clusters`);

  // Extract fraud rings from clusters
  const rings = extractFraudRings(clusters, graph);
  console.log(`[FraudRingDetector] Extracted ${rings.length} fraud rings`);

  // Save to database
  for (const ring of rings) {
    await saveFraudRing(ring);
  }

  return rings;
}
