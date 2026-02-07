// Agent Alpha - Graph Anomaly Detection
// Detects structural anomalies in the knowledge graph

import {
  KnowledgeGraph,
  AgentAnalysis,
  AgentFinding,
  FraudRing,
  FraudSeverity,
} from '@/types/lunar-graph';
import { openRouterClient } from './openrouter-client';
import { v4 as uuidv4 } from 'uuid';

const AGENT_NAME = 'Agent Alpha';
const AGENT_TYPE = 'alpha';

interface Cluster {
  id: string;
  nodes: string[];
  avgRiskScore: number;
  fraudEdgeCount: number;
  density: number;
}

// ============ COMMUNITY DETECTION ============

function detectCommunities(graph: KnowledgeGraph): Cluster[] {
  // Simple community detection based on connected components with fraud edges
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
      // Calculate cluster metrics
      const clusterNodes = graph.nodes.filter(n => component.includes(n.id));
      const avgRiskScore = clusterNodes.reduce((sum, n) => sum + n.riskScore, 0) / clusterNodes.length;

      const clusterEdges = graph.edges.filter(
        e => component.includes(e.source) && component.includes(e.target)
      );
      const fraudEdgeCount = clusterEdges.filter(e => e.isFraudIndicator).length;

      // Density = actual edges / possible edges
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

// ============ HUB DETECTION ============

interface HubNode {
  nodeId: string;
  label: string;
  degree: number;
  fraudDegree: number;
  riskScore: number;
}

function detectHubs(graph: KnowledgeGraph): HubNode[] {
  // Calculate degree for each node
  const degrees: Record<string, { total: number; fraud: number }> = {};

  for (const edge of graph.edges) {
    if (!degrees[edge.source]) degrees[edge.source] = { total: 0, fraud: 0 };
    if (!degrees[edge.target]) degrees[edge.target] = { total: 0, fraud: 0 };

    degrees[edge.source].total++;
    degrees[edge.target].total++;

    if (edge.isFraudIndicator) {
      degrees[edge.source].fraud++;
      degrees[edge.target].fraud++;
    }
  }

  // Find nodes with unusually high degree
  const avgDegree = Object.values(degrees).reduce((sum, d) => sum + d.total, 0) / Object.keys(degrees).length || 1;
  const hubThreshold = avgDegree * 2;

  const hubs: HubNode[] = [];
  for (const [nodeId, degree] of Object.entries(degrees)) {
    if (degree.total >= hubThreshold || degree.fraud >= 3) {
      const node = graph.nodes.find(n => n.id === nodeId);
      hubs.push({
        nodeId,
        label: node?.label || nodeId,
        degree: degree.total,
        fraudDegree: degree.fraud,
        riskScore: node?.riskScore || 0,
      });
    }
  }

  return hubs.sort((a, b) => b.fraudDegree - a.fraudDegree);
}

// ============ STRUCTURAL SIMILARITY ============

interface SimilarityPair {
  nodeA: string;
  nodeB: string;
  similarity: number;
  sharedNeighbors: string[];
}

function detectStructuralSimilarity(graph: KnowledgeGraph): SimilarityPair[] {
  // Build neighbor sets
  const neighbors: Record<string, Set<string>> = {};
  for (const edge of graph.edges) {
    if (!neighbors[edge.source]) neighbors[edge.source] = new Set();
    if (!neighbors[edge.target]) neighbors[edge.target] = new Set();
    neighbors[edge.source].add(edge.target);
    neighbors[edge.target].add(edge.source);
  }

  // Find pairs with high Jaccard similarity
  const pairs: SimilarityPair[] = [];
  const nodeIds = Object.keys(neighbors);

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const nodeA = nodeIds[i];
      const nodeB = nodeIds[j];

      const neighborsA = neighbors[nodeA];
      const neighborsB = neighbors[nodeB];

      // Calculate Jaccard similarity
      const intersection = new Set([...neighborsA].filter(x => neighborsB.has(x)));
      const union = new Set([...neighborsA, ...neighborsB]);

      if (union.size > 0) {
        const similarity = intersection.size / union.size;

        // High similarity with shared fraud-related neighbors is suspicious
        if (similarity >= 0.5 && intersection.size >= 2) {
          pairs.push({
            nodeA,
            nodeB,
            similarity,
            sharedNeighbors: [...intersection],
          });
        }
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 20);
}

// ============ FINDINGS GENERATION ============

function getSeverity(score: number): FraudSeverity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function generateFindings(
  clusters: Cluster[],
  hubs: HubNode[],
  similarities: SimilarityPair[],
  graph: KnowledgeGraph
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  // Cluster findings
  for (const cluster of clusters.slice(0, 5)) {
    if (cluster.avgRiskScore >= 30 || cluster.fraudEdgeCount >= 2) {
      findings.push({
        id: uuidv4(),
        type: 'suspicious_cluster',
        severity: getSeverity(cluster.avgRiskScore),
        title: `Suspicious Cluster Detected (${cluster.nodes.length} entities)`,
        description: `Found tightly connected cluster with ${cluster.fraudEdgeCount} fraud indicators and average risk score of ${Math.round(cluster.avgRiskScore)}%`,
        confidence: Math.min(95, 50 + cluster.fraudEdgeCount * 10),
        entities: cluster.nodes,
        evidence: [
          `Cluster density: ${(cluster.density * 100).toFixed(1)}%`,
          `Fraud edges: ${cluster.fraudEdgeCount}`,
          `Average risk: ${Math.round(cluster.avgRiskScore)}%`,
        ],
        suggestedAction: cluster.avgRiskScore >= 60
          ? 'Immediate investigation recommended'
          : 'Monitor and review connections',
      });
    }
  }

  // Hub findings
  for (const hub of hubs.slice(0, 5)) {
    if (hub.fraudDegree >= 2) {
      findings.push({
        id: uuidv4(),
        type: 'hub_detection',
        severity: getSeverity(hub.riskScore),
        title: `High-Connectivity Hub: ${hub.label}`,
        description: `Entity has ${hub.degree} total connections with ${hub.fraudDegree} fraud-related connections`,
        confidence: Math.min(90, 50 + hub.fraudDegree * 15),
        entities: [hub.nodeId],
        evidence: [
          `Total connections: ${hub.degree}`,
          `Fraud connections: ${hub.fraudDegree}`,
          `Risk score: ${hub.riskScore}%`,
        ],
        suggestedAction: 'Review all connected accounts and their activity',
      });
    }
  }

  // Structural similarity findings
  for (const pair of similarities.slice(0, 3)) {
    const nodeA = graph.nodes.find(n => n.id === pair.nodeA);
    const nodeB = graph.nodes.find(n => n.id === pair.nodeB);

    if (pair.similarity >= 0.6) {
      findings.push({
        id: uuidv4(),
        type: 'structural_similarity',
        severity: 'medium',
        title: `Structurally Similar Accounts`,
        description: `${nodeA?.label || pair.nodeA} and ${nodeB?.label || pair.nodeB} share ${pair.sharedNeighbors.length} common connections (${(pair.similarity * 100).toFixed(0)}% similarity)`,
        confidence: Math.round(pair.similarity * 100),
        entities: [pair.nodeA, pair.nodeB, ...pair.sharedNeighbors],
        evidence: [
          `Jaccard similarity: ${(pair.similarity * 100).toFixed(1)}%`,
          `Shared neighbors: ${pair.sharedNeighbors.length}`,
        ],
        suggestedAction: 'Check if accounts may be controlled by same entity',
      });
    }
  }

  return findings.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

// ============ FRAUD RING EXTRACTION ============

function extractFraudRings(
  clusters: Cluster[],
  graph: KnowledgeGraph
): FraudRing[] {
  const rings: FraudRing[] = [];

  for (const cluster of clusters.filter(c => c.avgRiskScore >= 50 || c.fraudEdgeCount >= 3)) {
    // Determine ring type based on edge composition
    const clusterEdges = graph.edges.filter(
      e => cluster.nodes.includes(e.source) || cluster.nodes.includes(e.target)
    );

    const hasOpposite = clusterEdges.some(e => e.type === 'opposite_position');
    const hasDevice = clusterEdges.some(e => e.type === 'device_match');
    const hasIP = clusterEdges.some(e => e.type === 'ip_overlap' && e.isFraudIndicator);
    const hasTiming = clusterEdges.some(e => e.type === 'timing_sync' && e.isFraudIndicator);

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

    rings.push({
      id: uuidv4(),
      name: `Ring ${rings.length + 1}: ${ringType.replace('_', ' ').toUpperCase()}`,
      type: ringType,
      severity: getSeverity(cluster.avgRiskScore),
      confidence: Math.min(95, 50 + cluster.fraudEdgeCount * 10),
      entities: cluster.nodes,
      exposure,
      evidence: clusterEdges
        .filter(e => e.isFraudIndicator)
        .map(e => ({
          type: e.type,
          description: e.metadata.description || `${e.type} connection`,
          confidence: e.metadata.confidence || 50,
          sourceNodes: [e.source],
          sourceEdges: [e.id],
          timestamp: e.metadata.detectedAt || new Date().toISOString(),
        })),
      aiSummary: '', // Will be filled by AI
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }

  return rings;
}

// ============ MAIN ANALYSIS ============

export async function runAgentAlpha(graph: KnowledgeGraph): Promise<{
  analysis: AgentAnalysis;
  fraudRings: FraudRing[];
}> {
  const startTime = new Date().toISOString();
  console.log('[Agent Alpha] Starting graph anomaly detection...');

  // Run detection algorithms
  const clusters = detectCommunities(graph);
  const hubs = detectHubs(graph);
  const similarities = detectStructuralSimilarity(graph);

  console.log(`[Agent Alpha] Found ${clusters.length} clusters, ${hubs.length} hubs, ${similarities.length} similar pairs`);

  // Generate findings
  const findings = generateFindings(clusters, hubs, similarities, graph);

  // Extract fraud rings
  const fraudRings = extractFraudRings(clusters, graph);

  // Generate AI summary for each fraud ring
  for (const ring of fraudRings) {
    try {
      const ringContext = JSON.stringify({
        type: ring.type,
        entities: ring.entities.length,
        exposure: ring.exposure,
        evidence: ring.evidence.map(e => e.description),
      });
      ring.aiSummary = await openRouterClient.explainFraudRing(ringContext);
    } catch (error) {
      ring.aiSummary = `${ring.type.replace('_', ' ')} fraud ring involving ${ring.entities.length} entities with $${ring.exposure.toFixed(2)} exposure.`;
    }
  }

  // Generate overall summary
  let summary = `Agent Alpha analyzed ${graph.stats.totalNodes} nodes and ${graph.stats.totalEdges} edges. `;
  summary += `Detected ${clusters.length} suspicious clusters and ${hubs.length} hub entities. `;
  summary += `Extracted ${fraudRings.length} potential fraud rings. `;
  summary += `${findings.filter(f => f.severity === 'critical').length} critical, ${findings.filter(f => f.severity === 'high').length} high-severity findings.`;

  const analysis: AgentAnalysis = {
    agentType: 'alpha',
    agentName: AGENT_NAME,
    status: 'completed',
    startedAt: startTime,
    completedAt: new Date().toISOString(),
    findings,
    summary,
    metrics: {
      clustersDetected: clusters.length,
      hubsDetected: hubs.length,
      similarPairs: similarities.length,
      fraudRingsExtracted: fraudRings.length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
    },
  };

  console.log(`[Agent Alpha] Analysis complete: ${findings.length} findings, ${fraudRings.length} fraud rings`);

  return { analysis, fraudRings };
}
