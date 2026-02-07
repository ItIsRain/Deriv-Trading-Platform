'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  KnowledgeGraph,
  CombinedAnalysis,
  FraudRing,
  LunarAlert,
  GraphNodeData,
  GraphEdgeData,
  AgentAnalysis,
} from '@/types/lunar-graph';
import { FraudRingCardCompact } from '@/components/lunar-graph/FraudRingCard';
import AlertFeed, { AlertSummary } from '@/components/lunar-graph/AlertFeed';
import AgentStatusPanel from '@/components/lunar-graph/AgentStatusPanel';
import InvestigationCopilot from '@/components/lunar-graph/InvestigationCopilot';

// Dynamically import Cytoscape component (no SSR)
const KnowledgeGraphView = dynamic(
  () => import('@/components/lunar-graph/KnowledgeGraphView'),
  { ssr: false, loading: () => <GraphLoadingState /> }
);

function GraphLoadingState() {
  return (
    <div className="flex items-center justify-center bg-[#0a0a0f] rounded-lg border border-[rgba(255,68,79,0.2)] h-[500px]">
      <div className="text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
        <p>Loading graph viewer...</p>
      </div>
    </div>
  );
}

// Helper to convert entity IDs to human-readable labels
function resolveEntityLabel(entityId: string, graph: KnowledgeGraph | null): string {
  if (!graph) return entityId;

  const node = graph.nodes.find(n => n.id === entityId);
  if (node) {
    // Build a descriptive label based on node type
    if (node.type === 'trade') {
      const type = node.metadata.contractType || '';
      const amount = node.metadata.amount ? `$${node.metadata.amount}` : '';
      const symbol = node.metadata.symbol || '';
      return `${amount} ${type} on ${symbol}`.trim() || node.label;
    }
    if (node.type === 'affiliate') {
      return node.metadata.email || node.label;
    }
    if (node.type === 'client') {
      return node.metadata.email || node.label;
    }
    if (node.type === 'ip') {
      return `IP ${node.metadata.ipAddress || node.label}`;
    }
    if (node.type === 'device') {
      return `Device ${node.label}`;
    }
    return node.label;
  }

  // Fallback: extract readable part from ID
  if (entityId.startsWith('trade_')) {
    return `Trade ${entityId.slice(6, 14)}...`;
  }
  if (entityId.startsWith('affiliate_')) {
    return `Affiliate ${entityId.slice(10, 18)}...`;
  }
  if (entityId.startsWith('client_')) {
    return `Client ${entityId.slice(7, 15)}...`;
  }

  return entityId;
}

// Helper to resolve multiple entities to readable labels
function resolveEntityLabels(entities: string[], graph: KnowledgeGraph | null): string[] {
  return entities.map(id => resolveEntityLabel(id, graph));
}

// Update graph node risk scores based on agent findings
function applyAnalysisToGraph(graph: KnowledgeGraph, analysis: CombinedAnalysis): KnowledgeGraph {
  // Track minimum risk scores and boosts for entities
  const entityMinRisk: Record<string, number> = {};
  const entityRiskBoosts: Record<string, number> = {};

  for (const agent of analysis.agents) {
    for (const finding of agent.findings) {
      // Set minimum risk based on severity - ensures all entities in same finding get same color
      const minRisk =
        finding.severity === 'critical' ? 75 :
        finding.severity === 'high' ? 55 :
        finding.severity === 'medium' ? 40 : 25;

      // Also add a boost on top of minimum
      const boost =
        finding.severity === 'critical' ? 35 :
        finding.severity === 'high' ? 25 :
        finding.severity === 'medium' ? 15 : 5;

      for (const entityId of finding.entities) {
        entityMinRisk[entityId] = Math.max(entityMinRisk[entityId] || 0, minRisk);
        entityRiskBoosts[entityId] = Math.max(entityRiskBoosts[entityId] || 0, boost);
      }
    }
  }

  // Also boost entities in fraud rings
  for (const ring of analysis.fraudRings) {
    const minRisk =
      ring.severity === 'critical' ? 80 :
      ring.severity === 'high' ? 60 :
      ring.severity === 'medium' ? 45 : 30;

    const boost =
      ring.severity === 'critical' ? 40 :
      ring.severity === 'high' ? 30 :
      ring.severity === 'medium' ? 20 : 10;

    for (const entityId of ring.entities) {
      entityMinRisk[entityId] = Math.max(entityMinRisk[entityId] || 0, minRisk);
      entityRiskBoosts[entityId] = Math.max(entityRiskBoosts[entityId] || 0, boost);
    }
  }

  // Apply boosts and minimum risk to nodes
  const updatedNodes = graph.nodes.map(node => {
    const minRisk = entityMinRisk[node.id] || 0;
    const boost = entityRiskBoosts[node.id] || 0;

    if (minRisk > 0 || boost > 0) {
      // Use the higher of: current + boost, or minimum risk
      const boostedScore = node.riskScore + boost;
      const newScore = Math.max(boostedScore, minRisk);
      return {
        ...node,
        riskScore: Math.min(100, newScore),
      };
    }
    return node;
  });

  // Recalculate stats
  const avgRiskScore = updatedNodes.length > 0
    ? Math.round(updatedNodes.reduce((sum, n) => sum + n.riskScore, 0) / updatedNodes.length)
    : 0;

  return {
    ...graph,
    nodes: updatedNodes,
    stats: {
      ...graph.stats,
      avgRiskScore,
    },
  };
}

// Simple markdown renderer for AI summaries
function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="text-sm space-y-2">
      {content.split('\n').map((line, i) => {
        const trimmed = line.trim();

        // H2 headers
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-white font-semibold text-base mt-4 mb-2 first:mt-0">
              {trimmed.slice(3)}
            </h3>
          );
        }

        // H1 headers
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={i} className="text-white font-bold text-lg mt-4 mb-2 first:mt-0">
              {trimmed.slice(2)}
            </h2>
          );
        }

        // Bold text (standalone line)
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <p key={i} className="text-white font-semibold mt-3 first:mt-0">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          return (
            <p key={i} className="text-gray-300 ml-4">
              {trimmed}
            </p>
          );
        }

        // Bullet list
        if (trimmed.startsWith('- ')) {
          return (
            <p key={i} className="text-gray-300 ml-4">
              • {trimmed.slice(2)}
            </p>
          );
        }

        // Empty line
        if (trimmed === '') {
          return <div key={i} className="h-2" />;
        }

        // Regular text - handle inline bold
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-gray-300">
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="text-white font-medium">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function LunarGraphPage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [analysis, setAnalysis] = useState<CombinedAnalysis | null>(null);
  const [fraudRings, setFraudRings] = useState<FraudRing[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdgeData | null>(null);
  const [selectedRing, setSelectedRing] = useState<FraudRing | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentAnalysis | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<LunarAlert | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'graph' | 'copilot'>('graph');
  const [error, setError] = useState<string | null>(null);

  // Load graph, fraud rings, and saved analysis on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load graph and saved analysis in parallel
        const [graphResponse, analysisResponse] = await Promise.all([
          fetch('/api/lunar-graph/build-graph', { method: 'POST' }),
          fetch('/api/lunar-graph/load-analysis'),
        ]);

        const graphData = await graphResponse.json();
        const analysisData = await analysisResponse.json();

        let loadedGraph = null;
        if (graphData.success && graphData.graph) {
          loadedGraph = graphData.graph;
          if (graphData.fraudRings && graphData.fraudRings.length > 0) {
            setFraudRings(graphData.fraudRings);
          }
        }

        // Load saved analysis if available
        if (analysisData.success && analysisData.hasAnalysis) {
          setAnalysis(analysisData.analysis);
          if (analysisData.fraudRings && analysisData.fraudRings.length > 0) {
            setFraudRings(analysisData.fraudRings);
          }
          // Apply analysis findings to boost node risk scores
          if (loadedGraph && analysisData.analysis) {
            loadedGraph = applyAnalysisToGraph(loadedGraph, analysisData.analysis);
          }
        }

        if (loadedGraph) {
          setGraph(loadedGraph);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Build knowledge graph
  const handleBuildGraph = useCallback(async () => {
    setIsBuilding(true);
    setError(null);
    try {
      const response = await fetch('/api/lunar-graph/build-graph', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.graph) {
        setGraph(data.graph);
        // Set fraud rings from the build response (loaded from database)
        if (data.fraudRings && data.fraudRings.length > 0) {
          setFraudRings(data.fraudRings);
        }
      } else {
        setError(data.error || 'Failed to build graph');
      }
    } catch (err) {
      setError('Network error while building graph');
    } finally {
      setIsBuilding(false);
    }
  }, []);

  // Run fraud analysis
  const handleRunAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch('/api/lunar-graph/analyze', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        // Update fraud rings from analysis (saved to database by API)
        if (data.analysis.fraudRings && data.analysis.fraudRings.length > 0) {
          setFraudRings(data.analysis.fraudRings);
        }
        // Apply analysis findings to boost node risk scores
        if (graph) {
          const updatedGraph = applyAnalysisToGraph(graph, data.analysis);
          setGraph(updatedGraph);
        }
      } else {
        setError(data.error || 'Failed to run analysis');
      }
    } catch (err) {
      setError('Network error while running analysis');
    } finally {
      setIsAnalyzing(false);
    }
  }, [graph]);

  // Reset investigation - clear everything
  const handleRestart = useCallback(async () => {
    if (!confirm('Are you sure you want to restart the investigation? This will clear all analysis data.')) {
      return;
    }

    setIsResetting(true);
    setError(null);
    try {
      // Clear database
      const response = await fetch('/api/lunar-graph/reset', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        // Reset all state
        setGraph(null);
        setAnalysis(null);
        setFraudRings([]);
        setSelectedNode(null);
        setSelectedEdge(null);
        setSelectedRing(null);
        setSelectedAgent(null);
        setActiveTab('graph');
      } else {
        setError(data.error || 'Failed to reset investigation');
      }
    } catch (err) {
      setError('Network error while resetting');
    } finally {
      setIsResetting(false);
    }
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string, nodeData: GraphNodeData) => {
    setSelectedNode(nodeData);
    setSelectedEdge(null);
    setSelectedRing(null);
    setSelectedAgent(null);
    setSelectedAlert(null);
  }, []);

  // Handle edge selection
  const handleEdgeSelect = useCallback((edgeId: string, edgeData: GraphEdgeData) => {
    setSelectedEdge(edgeData);
    setSelectedNode(null);
    setSelectedAgent(null);
    setSelectedAlert(null);
  }, []);

  // Handle fraud ring selection
  const handleRingSelect = useCallback((ring: FraudRing) => {
    setSelectedRing(ring);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedAgent(null);
    setSelectedAlert(null);
  }, []);

  // Handle agent click - show agent findings
  const handleAgentClick = useCallback((agent: AgentAnalysis) => {
    setSelectedAgent(agent);
    setSelectedRing(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedAlert(null);
  }, []);

  // Handle alert click - show details for the alert
  const handleAlertClick = useCallback((alert: LunarAlert) => {
    // Set the selected alert to show its details
    setSelectedAlert(alert);
    setSelectedRing(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedAgent(null);
    // Stay on graph tab to show the details panel
    setActiveTab('graph');
  }, []);

  // Get highlighted nodes for the graph
  const highlightedNodes = selectedRing?.entities || [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        .lg-page { min-height: 100vh; background: #06060B; font-family: 'Outfit', sans-serif; position: relative; overflow-x: hidden; }
        .lg-page::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,68,79,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(59,130,246,0.05) 0%, transparent 50%); pointer-events: none; z-index: 0; }
        .lg-page > * { position: relative; z-index: 1; }

        .lg-header { background: linear-gradient(180deg, rgba(12,12,18,0.95) 0%, rgba(12,12,18,0.8) 100%); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; z-index: 50; }
        .lg-header-inner { max-width: 1800px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
        .lg-header-left { display: flex; align-items: center; gap: 16px; }
        .lg-header-divider { width: 1px; height: 28px; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.15), transparent); }
        .lg-header-title { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: -0.02em; }
        .lg-header-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.15em; margin-top: 1px; }
        .lg-header-right { display: flex; align-items: center; gap: 12px; }
        .lg-portal-link { padding: 6px 16px; font-size: 13px; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; text-decoration: none; transition: all 0.2s; font-weight: 500; }
        .lg-portal-link:hover { color: #fff; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.04); }
        .lg-live-badge { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 20px; background: rgba(255,68,79,0.08); border: 1px solid rgba(255,68,79,0.15); }
        .lg-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #FF444F; box-shadow: 0 0 8px rgba(255,68,79,0.6), 0 0 20px rgba(255,68,79,0.3); animation: lg-pulse 2s ease-in-out infinite; }
        .lg-live-text { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: #FF444F; letter-spacing: 0.12em; text-transform: uppercase; }
        @keyframes lg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .lg-main { max-width: 1800px; margin: 0 auto; padding: 20px 24px; }
        .lg-grid { display: grid; grid-template-columns: 280px 1fr 300px; gap: 16px; }

        .lg-error { margin-bottom: 16px; padding: 12px 16px; border-radius: 12px; background: rgba(255,68,79,0.06); border: 1px solid rgba(255,68,79,0.15); display: flex; align-items: center; justify-content: space-between; }
        .lg-error span { font-size: 13px; color: #FF6B73; font-weight: 500; }
        .lg-error button { color: rgba(255,255,255,0.3); font-size: 16px; padding: 4px; border: none; background: none; cursor: pointer; transition: color 0.2s; }
        .lg-error button:hover { color: #fff; }

        .lg-panel { background: rgba(14,14,22,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; transition: border-color 0.3s; }
        .lg-panel:hover { border-color: rgba(255,255,255,0.1); }
        .lg-panel-header { padding: 16px 18px 12px; display: flex; align-items: center; justify-content: space-between; }
        .lg-panel-title { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace; }
        .lg-panel-body { padding: 0 18px 18px; }
        .lg-panel-accent { border-top: 1px solid rgba(255,68,79,0.15); }

        .lg-btn { width: 100%; padding: 10px 16px; font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif; border: none; border-radius: 10px; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; overflow: hidden; }
        .lg-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }
        .lg-btn-build { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.08); }
        .lg-btn-build:not(:disabled):hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: #fff; transform: translateY(-1px); }
        .lg-btn-analyze { background: linear-gradient(135deg, #FF444F 0%, #E03640 100%); color: #fff; box-shadow: 0 4px 20px rgba(255,68,79,0.25), inset 0 1px 0 rgba(255,255,255,0.1); }
        .lg-btn-analyze:not(:disabled):hover { box-shadow: 0 6px 28px rgba(255,68,79,0.4), inset 0 1px 0 rgba(255,255,255,0.15); transform: translateY(-1px); }
        .lg-btn-reset { background: transparent; color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.06); }
        .lg-btn-reset:not(:disabled):hover { color: #FF6B73; border-color: rgba(255,68,79,0.2); background: rgba(255,68,79,0.05); }
        .lg-btn-divider { height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); margin: 10px 0; }

        .lg-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .lg-stat-box { text-align: center; padding: 12px 8px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); transition: all 0.2s; }
        .lg-stat-box:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.08); }
        .lg-stat-box.red { background: rgba(255,68,79,0.06); border-color: rgba(255,68,79,0.1); }
        .lg-stat-box.amber { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.1); }
        .lg-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: #fff; line-height: 1; }
        .lg-stat-box.red .lg-stat-val { color: #FF6B73; }
        .lg-stat-box.amber .lg-stat-val { color: #FBBF24; }
        .lg-stat-lbl { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }

        .lg-tabs { display: flex; gap: 4px; padding: 4px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
        .lg-tab { flex: 1; padding: 10px 16px; font-size: 13px; font-weight: 600; font-family: 'Outfit', sans-serif; border-radius: 9px; border: none; cursor: pointer; transition: all 0.25s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .lg-tab-active { background: linear-gradient(135deg, #FF444F 0%, #D63840 100%); color: #fff; box-shadow: 0 4px 16px rgba(255,68,79,0.3); }
        .lg-tab-inactive { background: transparent; color: rgba(255,255,255,0.35); }
        .lg-tab-inactive:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }

        .lg-detail-panel { background: rgba(14,14,22,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; }
        .lg-detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .lg-detail-title { font-size: 14px; font-weight: 600; color: #fff; }
        .lg-detail-badge { padding: 3px 10px; font-size: 11px; font-weight: 600; border-radius: 6px; font-family: 'JetBrains Mono', monospace; }
        .lg-detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font-size: 13px; }
        .lg-detail-key { color: rgba(255,255,255,0.35); font-weight: 500; }
        .lg-detail-value { color: #fff; font-weight: 500; }
        .lg-detail-close { background: none; border: none; color: rgba(255,255,255,0.3); cursor: pointer; padding: 4px 8px; font-size: 12px; border-radius: 6px; transition: all 0.2s; font-family: 'Outfit', sans-serif; }
        .lg-detail-close:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .lg-detail-metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .lg-detail-metric { text-align: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); }
        .lg-detail-metric-val { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #fff; }
        .lg-detail-metric-lbl { font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }

        .lg-finding { padding: 12px 14px; border-radius: 10px; border: 1px solid; margin-bottom: 8px; }
        .lg-finding-crit { background: rgba(255,68,79,0.06); border-color: rgba(255,68,79,0.15); }
        .lg-finding-high { background: rgba(249,115,22,0.06); border-color: rgba(249,115,22,0.15); }
        .lg-finding-med { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.15); }
        .lg-finding-low { background: rgba(59,130,246,0.06); border-color: rgba(59,130,246,0.15); }
        .lg-sev-badge { display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; border-radius: 4px; letter-spacing: 0.05em; font-family: 'JetBrains Mono', monospace; }

        .lg-analysis-bar { background: rgba(14,14,22,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; }
        .lg-risk-indicator { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .lg-analysis-text { font-size: 13px; color: rgba(255,255,255,0.5); flex: 1; line-height: 1.5; }
        .lg-analysis-score { font-size: 14px; font-weight: 700; color: #fff; font-family: 'JetBrains Mono', monospace; white-space: nowrap; }
        .lg-analysis-time { font-size: 11px; color: rgba(255,255,255,0.2); font-family: 'JetBrains Mono', monospace; }

        .lg-feed-header { display: flex; align-items: center; gap: 8px; }
        .lg-feed-live { display: flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 20px; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15); }
        .lg-feed-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #10B981; box-shadow: 0 0 6px rgba(16,185,129,0.6); animation: lg-pulse 2s ease-in-out infinite; }
        .lg-feed-live-text { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; color: #10B981; letter-spacing: 0.1em; text-transform: uppercase; }

        .lg-sidebar-col { display: flex; flex-direction: column; gap: 12px; }
        .lg-center-col { display: flex; flex-direction: column; gap: 12px; }

        .lg-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: lg-spin 0.6s linear infinite; }
        .lg-spinner-red { border-color: rgba(255,255,255,0.2); border-top-color: #fff; }
        @keyframes lg-spin { to { transform: rotate(360deg); } }

        @keyframes lg-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .lg-animate { animation: lg-fadein 0.4s ease-out forwards; }
        .lg-delay-1 { animation-delay: 0.05s; opacity: 0; }
        .lg-delay-2 { animation-delay: 0.1s; opacity: 0; }
        .lg-delay-3 { animation-delay: 0.15s; opacity: 0; }
        .lg-delay-4 { animation-delay: 0.2s; opacity: 0; }
      `}</style>

      <div className="lg-page">
        {/* Header */}
        <header className="lg-header">
          <div className="lg-header-inner">
            <div className="lg-header-left">
              <Link href="/">
                <img src="/LunarDark.svg" alt="Logo" style={{ height: 36 }} />
              </Link>
              <div className="lg-header-divider" />
              <div>
                <div className="lg-header-title">Lunar Graph</div>
                <div className="lg-header-sub">Fraud Intelligence Platform</div>
              </div>
            </div>
            <div className="lg-header-right">
              <Link href="/dashboard" className="lg-portal-link">
                Partner Portal
              </Link>
              <div className="lg-live-badge">
                <span className="lg-live-dot" />
                <span className="lg-live-text">Live Monitoring</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="lg-main">
          {/* Error Banner */}
          {error && (
            <div className="lg-error">
              <span>{error}</span>
              <button onClick={() => setError(null)}>&#x2715;</button>
            </div>
          )}

          <div className="lg-grid">
            {/* Left Sidebar */}
            <div className="lg-sidebar-col">
              {/* Actions */}
              <div className="lg-panel lg-animate lg-delay-1">
                <div className="lg-panel-header">
                  <span className="lg-panel-title">Actions</span>
                </div>
                <div className="lg-panel-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      onClick={handleBuildGraph}
                      disabled={isBuilding}
                      className="lg-btn lg-btn-build"
                    >
                      {isBuilding ? (
                        <>
                          <span className="lg-spinner" />
                          Building...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/>
                            <path d="M12 9V6.5a2.5 2.5 0 0 0-5 0"/><path d="M12 9V6.5a2.5 2.5 0 0 1 5 0"/><path d="M12 15v2.5a2.5 2.5 0 0 1-5 0"/><path d="M12 15v2.5a2.5 2.5 0 0 0 5 0"/>
                          </svg>
                          Build Graph
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      className="lg-btn lg-btn-analyze"
                    >
                      {isAnalyzing ? (
                        <>
                          <span className="lg-spinner lg-spinner-red" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                          Run Analysis
                        </>
                      )}
                    </button>

                    <div className="lg-btn-divider" />

                    <button
                      onClick={handleRestart}
                      disabled={isResetting}
                      className="lg-btn lg-btn-reset"
                    >
                      {isResetting ? (
                        <>
                          <span className="lg-spinner" style={{ borderTopColor: '#FF6B73' }} />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                          </svg>
                          Restart Investigation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Graph Stats */}
              {graph && (
                <div className="lg-panel lg-animate lg-delay-2">
                  <div className="lg-panel-header">
                    <span className="lg-panel-title">Graph Stats</span>
                  </div>
                  <div className="lg-panel-body">
                    <div className="lg-stats-grid">
                      <div className="lg-stat-box">
                        <div className="lg-stat-val">{graph.stats.totalNodes}</div>
                        <div className="lg-stat-lbl">Nodes</div>
                      </div>
                      <div className="lg-stat-box">
                        <div className="lg-stat-val">{graph.stats.totalEdges}</div>
                        <div className="lg-stat-lbl">Edges</div>
                      </div>
                      <div className="lg-stat-box red">
                        <div className="lg-stat-val">{graph.stats.fraudEdges}</div>
                        <div className="lg-stat-lbl">Fraud Edges</div>
                      </div>
                      <div className="lg-stat-box amber">
                        <div className="lg-stat-val">{graph.stats.avgRiskScore}%</div>
                        <div className="lg-stat-lbl">Avg Risk</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Agent Status */}
              <div className="lg-panel lg-animate lg-delay-3">
                <div className="lg-panel-header">
                  <span className="lg-panel-title">Agent Status</span>
                </div>
                <div className="lg-panel-body">
                  <AgentStatusPanel
                    agents={analysis?.agents || []}
                    isRunning={isAnalyzing}
                    onAgentClick={handleAgentClick}
                  />
                </div>
              </div>

              {/* Detected Fraud Rings */}
              <div className="lg-panel lg-animate lg-delay-4">
                <div className="lg-panel-header">
                  <span className="lg-panel-title">Fraud Rings</span>
                  {fraudRings.length > 0 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: '#FF6B73' }}>
                      {fraudRings.length} detected
                    </span>
                  )}
                </div>
                <div className="lg-panel-body">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {fraudRings.length > 0 ? (
                      fraudRings.map((ring) => (
                        <FraudRingCardCompact
                          key={ring.id}
                          ring={ring}
                          onClick={() => handleRingSelect(ring)}
                          isSelected={selectedRing?.id === ring.id}
                        />
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          </svg>
                        </div>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>No fraud rings detected</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center Panel */}
            <div className="lg-center-col">
              {/* Tab Switcher */}
              <div className="lg-tabs lg-animate lg-delay-1">
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`lg-tab ${activeTab === 'graph' ? 'lg-tab-active' : 'lg-tab-inactive'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  Knowledge Graph
                </button>
                <button
                  onClick={() => setActiveTab('copilot')}
                  className={`lg-tab ${activeTab === 'copilot' ? 'lg-tab-active' : 'lg-tab-inactive'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
                  </svg>
                  Investigation Copilot
                </button>
              </div>

              {/* Main Content Area */}
              <div className="lg-animate lg-delay-2">
                {activeTab === 'graph' ? (
                  <KnowledgeGraphView
                    graph={graph}
                    onNodeSelect={handleNodeSelect}
                    onEdgeSelect={handleEdgeSelect}
                    highlightedNodes={highlightedNodes}
                    height={500}
                  />
                ) : (
                  <InvestigationCopilot
                    selectedEntities={selectedRing?.entities || (selectedNode ? [selectedNode.id] : [])}
                    fraudRingId={selectedRing?.id}
                    graph={graph}
                    analysis={analysis}
                    fraudRings={fraudRings}
                    height={500}
                  />
                )}
              </div>

              {/* Selected Item Details */}
              {(selectedNode || selectedEdge || selectedRing || selectedAgent || selectedAlert) && (
                <div className="lg-detail-panel lg-animate">
                  {selectedNode && (
                    <div>
                      <div className="lg-detail-header">
                        <span className="lg-detail-title">
                          Node: {selectedNode.label}
                        </span>
                        <span className={`lg-detail-badge ${
                          selectedNode.riskScore >= 70 ? 'bg-red-500/20 text-red-400' :
                          selectedNode.riskScore >= 50 ? 'bg-orange-500/20 text-orange-400' :
                          selectedNode.riskScore >= 30 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          Risk: {selectedNode.riskScore}%
                        </span>
                      </div>
                      <div className="lg-detail-grid">
                        <div className="lg-detail-key">Type:</div>
                        <div className="lg-detail-value" style={{ textTransform: 'capitalize' }}>{selectedNode.type}</div>
                        {selectedNode.metadata.email && (
                          <>
                            <div className="lg-detail-key">Email:</div>
                            <div className="lg-detail-value">{selectedNode.metadata.email}</div>
                          </>
                        )}
                        {selectedNode.metadata.contractType && (
                          <>
                            <div className="lg-detail-key">Contract:</div>
                            <div className="lg-detail-value">{selectedNode.metadata.contractType}</div>
                          </>
                        )}
                        {selectedNode.metadata.amount && (
                          <>
                            <div className="lg-detail-key">Amount:</div>
                            <div className="lg-detail-value">${selectedNode.metadata.amount}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedEdge && (
                    <div>
                      <div className="lg-detail-header">
                        <span className="lg-detail-title" style={{ textTransform: 'capitalize' }}>
                          Edge: {selectedEdge.type.replace('_', ' ')}
                        </span>
                        {selectedEdge.isFraudIndicator && (
                          <span className="lg-detail-badge" style={{ background: 'rgba(255,68,79,0.15)', color: '#FF6B73' }}>
                            Fraud Indicator
                          </span>
                        )}
                      </div>
                      <div className="lg-detail-grid">
                        <div className="lg-detail-key">Weight:</div>
                        <div className="lg-detail-value">{(selectedEdge.weight * 100).toFixed(0)}%</div>
                        {selectedEdge.metadata.confidence && (
                          <>
                            <div className="lg-detail-key">Confidence:</div>
                            <div className="lg-detail-value">{selectedEdge.metadata.confidence}%</div>
                          </>
                        )}
                        {selectedEdge.metadata.description && (
                          <>
                            <div className="lg-detail-key">Details:</div>
                            <div className="lg-detail-value">{selectedEdge.metadata.description}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedRing && (
                    <div>
                      <div className="lg-detail-header">
                        <span className="lg-detail-title">{selectedRing.name}</span>
                        <span className={`lg-detail-badge ${
                          selectedRing.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                          selectedRing.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {selectedRing.severity.toUpperCase()}
                        </span>
                      </div>

                      {/* Metrics */}
                      <div className="lg-detail-metrics">
                        <div className="lg-detail-metric">
                          <div className="lg-detail-metric-val">{selectedRing.confidence}%</div>
                          <div className="lg-detail-metric-lbl">Confidence</div>
                        </div>
                        <div className="lg-detail-metric">
                          <div className="lg-detail-metric-val">{selectedRing.entities.length}</div>
                          <div className="lg-detail-metric-lbl">Entities</div>
                        </div>
                        <div className="lg-detail-metric">
                          <div className="lg-detail-metric-val">${selectedRing.exposure.toFixed(0)}</div>
                          <div className="lg-detail-metric-lbl">Exposure</div>
                        </div>
                      </div>

                      {/* AI Summary with markdown */}
                      {selectedRing.aiSummary && (
                        <div className="max-h-[300px] overflow-y-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                          <MarkdownContent content={selectedRing.aiSummary} />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedAgent && (
                    <div>
                      <div className="lg-detail-header">
                        <span className="lg-detail-title">{selectedAgent.agentName}</span>
                        <button
                          onClick={() => setSelectedAgent(null)}
                          className="lg-detail-close"
                        >
                          &#x2715; Close
                        </button>
                      </div>

                      {/* Agent Summary with markdown */}
                      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <MarkdownContent content={selectedAgent.summary} />
                      </div>

                      {/* Agent Findings */}
                      <div className="max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                          Findings ({selectedAgent.findings.length})
                        </div>
                        {selectedAgent.findings.slice(0, 10).map((finding, idx) => (
                          <div
                            key={idx}
                            className={`lg-finding ${
                              finding.severity === 'critical' ? 'lg-finding-crit' :
                              finding.severity === 'high' ? 'lg-finding-high' :
                              finding.severity === 'medium' ? 'lg-finding-med' :
                              'lg-finding-low'
                            }`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span className={`lg-sev-badge ${
                                finding.severity === 'critical' ? 'bg-red-500 text-white' :
                                finding.severity === 'high' ? 'bg-orange-500 text-white' :
                                finding.severity === 'medium' ? 'bg-yellow-500 text-black' :
                                'bg-blue-500 text-white'
                              }`}>
                                {finding.severity}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>
                                {finding.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <MarkdownContent content={finding.description} />
                            {finding.entities && finding.entities.length > 0 && (
                              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                                Entities: {resolveEntityLabels(finding.entities.slice(0, 3), graph).join(', ')}
                                {finding.entities.length > 3 && ` +${finding.entities.length - 3} more`}
                              </div>
                            )}
                          </div>
                        ))}
                        {selectedAgent.findings.length > 10 && (
                          <div style={{ textAlign: 'center', padding: 8, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                            +{selectedAgent.findings.length - 10} more findings
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedAlert && (
                    <div>
                      <div className="lg-detail-header">
                        <span className="lg-detail-title">{selectedAlert.title}</span>
                        <button
                          onClick={() => setSelectedAlert(null)}
                          className="lg-detail-close"
                        >
                          &#x2715; Close
                        </button>
                      </div>

                      {/* Severity badge */}
                      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`lg-sev-badge ${
                          selectedAlert.severity === 'critical' ? 'bg-red-500 text-white' :
                          selectedAlert.severity === 'high' ? 'bg-orange-500 text-white' :
                          selectedAlert.severity === 'medium' ? 'bg-yellow-500 text-black' :
                          'bg-blue-500 text-white'
                        }`}>
                          {selectedAlert.severity.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {new Date(selectedAlert.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {/* Entities */}
                      {selectedAlert.entities.length > 0 && (
                        <div style={{ marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)' }}>Entities involved:</span>{' '}
                          {resolveEntityLabels(selectedAlert.entities, graph).join(', ')}
                        </div>
                      )}

                      {/* AI Explanation / Description with markdown */}
                      <div className="max-h-[400px] overflow-y-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                        <MarkdownContent content={selectedAlert.aiExplanation || selectedAlert.description} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis Summary */}
              {analysis && (
                <div className="lg-analysis-bar lg-animate">
                  <div className={`lg-risk-indicator ${
                    analysis.overallRiskScore >= 70 ? 'bg-red-500' :
                    analysis.overallRiskScore >= 40 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`} style={{ boxShadow: analysis.overallRiskScore >= 70 ? '0 0 12px rgba(239,68,68,0.5)' : analysis.overallRiskScore >= 40 ? '0 0 12px rgba(234,179,8,0.5)' : '0 0 12px rgba(34,197,94,0.5)' }} />
                  <span className="lg-analysis-text">{analysis.summary}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span className="lg-analysis-score">
                      {analysis.overallRiskScore}/100
                    </span>
                    <span className="lg-analysis-time">
                      {new Date(analysis.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="lg-sidebar-col">
              {/* Alert Summary */}
              {analysis?.alerts && analysis.alerts.length > 0 && (
                <div className="lg-panel lg-animate lg-delay-1">
                  <div className="lg-panel-header">
                    <span className="lg-panel-title">Alert Summary</span>
                  </div>
                  <div className="lg-panel-body">
                    <AlertSummary alerts={analysis.alerts} />
                  </div>
                </div>
              )}

              {/* Live Alert Feed */}
              <div className="lg-panel lg-animate lg-delay-2" style={{ flex: 1 }}>
                <div className="lg-panel-header">
                  <span className="lg-panel-title">Live Feed</span>
                  <div className="lg-feed-live">
                    <span className="lg-feed-live-dot" />
                    <span className="lg-feed-live-text">Live</span>
                  </div>
                </div>
                <div className="lg-panel-body">
                  <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    <AlertFeed
                      alerts={analysis?.alerts || []}
                      onAlertClick={handleAlertClick}
                      maxItems={15}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
