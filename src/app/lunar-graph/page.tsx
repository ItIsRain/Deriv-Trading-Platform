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
  const [isBuilding, setIsBuilding] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'graph' | 'copilot'>('graph');
  const [error, setError] = useState<string | null>(null);

  // Load graph and fraud rings on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Always build fresh graph from database
        const response = await fetch('/api/lunar-graph/build-graph', {
          method: 'POST',
        });
        const data = await response.json();

        if (data.success && data.graph) {
          setGraph(data.graph);
          if (data.fraudRings && data.fraudRings.length > 0) {
            setFraudRings(data.fraudRings);
          }
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
        // Rebuild graph to reflect new analysis
        await handleBuildGraph();
      } else {
        setError(data.error || 'Failed to run analysis');
      }
    } catch (err) {
      setError('Network error while running analysis');
    } finally {
      setIsAnalyzing(false);
    }
  }, [handleBuildGraph]);

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
  }, []);

  // Handle edge selection
  const handleEdgeSelect = useCallback((edgeId: string, edgeData: GraphEdgeData) => {
    setSelectedEdge(edgeData);
    setSelectedNode(null);
    setSelectedAgent(null);
  }, []);

  // Handle fraud ring selection
  const handleRingSelect = useCallback((ring: FraudRing) => {
    setSelectedRing(ring);
    setSelectedNode(null);
    setSelectedEdge(null);
    setSelectedAgent(null);
  }, []);

  // Handle agent click - show agent findings
  const handleAgentClick = useCallback((agent: AgentAnalysis) => {
    setSelectedAgent(agent);
    setSelectedRing(null);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Handle alert click - switch to copilot and set context
  const handleAlertClick = useCallback((alert: LunarAlert) => {
    // If alert is linked to a fraud ring, select it
    if (alert.fraudRingId) {
      const ring = fraudRings.find(r => r.id === alert.fraudRingId);
      if (ring) {
        setSelectedRing(ring);
      }
    }
    // Switch to copilot tab with the alert context
    setActiveTab('copilot');
  }, [fraudRings]);

  // Get highlighted nodes for the graph
  const highlightedNodes = selectedRing?.entities || [];

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="border-b border-[rgba(255,68,79,0.15)] bg-[#161620]">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <img src="/LunarDark.svg" alt="Logo" className="h-10" />
              </Link>
              <div className="h-6 w-px bg-gray-700" />
              <div>
                <h1 className="text-lg font-semibold text-white">Lunar Graph</h1>
                <p className="text-xs text-gray-400">AI-Powered Fraud Detection</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Partner Portal
              </Link>
              <div className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                <span className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE MONITORING
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-between">
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 gap-4">
          {/* Left Sidebar */}
          <div className="col-span-3 space-y-4">
            {/* Actions */}
            <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Actions</h2>
              <div className="space-y-2">
                <button
                  onClick={handleBuildGraph}
                  disabled={isBuilding}
                  className="w-full px-4 py-2 text-sm font-medium bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isBuilding ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                      Building...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/>
                        <circle cx="5" cy="6" r="2"/>
                        <circle cx="19" cy="6" r="2"/>
                        <circle cx="5" cy="18" r="2"/>
                        <circle cx="19" cy="18" r="2"/>
                        <path d="M12 9V6.5a2.5 2.5 0 0 0-5 0"/>
                        <path d="M12 9V6.5a2.5 2.5 0 0 1 5 0"/>
                        <path d="M12 15v2.5a2.5 2.5 0 0 1-5 0"/>
                        <path d="M12 15v2.5a2.5 2.5 0 0 0 5 0"/>
                      </svg>
                      Build Graph
                    </>
                  )}
                </button>
                <button
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="w-full px-4 py-2 text-sm font-medium bg-[#FF444F] hover:bg-[#FF5A63] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-red-300 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      Run Analysis
                    </>
                  )}
                </button>

                {/* Separator */}
                <div className="border-t border-[rgba(255,255,255,0.1)] my-2" />

                {/* Restart Investigation */}
                <button
                  onClick={handleRestart}
                  disabled={isResetting}
                  className="w-full px-4 py-2 text-sm font-medium bg-[rgba(255,255,255,0.05)] hover:bg-red-500/20 hover:border-red-500/30 border border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-gray-400 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-500 border-t-red-400 rounded-full animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                      </svg>
                      Restart Investigation
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Graph Stats */}
            {graph && (
              <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Graph Stats</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-[rgba(255,255,255,0.05)] rounded">
                    <div className="text-lg font-bold text-white">{graph.stats.totalNodes}</div>
                    <div className="text-xs text-gray-400">Nodes</div>
                  </div>
                  <div className="text-center p-2 bg-[rgba(255,255,255,0.05)] rounded">
                    <div className="text-lg font-bold text-white">{graph.stats.totalEdges}</div>
                    <div className="text-xs text-gray-400">Edges</div>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded">
                    <div className="text-lg font-bold text-red-400">{graph.stats.fraudEdges}</div>
                    <div className="text-xs text-gray-400">Fraud Edges</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-500/10 rounded">
                    <div className="text-lg font-bold text-yellow-400">{graph.stats.avgRiskScore}%</div>
                    <div className="text-xs text-gray-400">Avg Risk</div>
                  </div>
                </div>
              </div>
            )}

            {/* Agent Status */}
            <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
              <h2 className="text-sm font-semibold text-white mb-3">Agent Status</h2>
              <AgentStatusPanel
                agents={analysis?.agents || []}
                isRunning={isAnalyzing}
                onAgentClick={handleAgentClick}
              />
            </div>

            {/* Detected Fraud Rings */}
            <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Fraud Rings</h2>
                {fraudRings.length > 0 && (
                  <span className="text-xs text-red-400">{fraudRings.length} detected</span>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
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
                  <p className="text-sm text-gray-500 text-center py-4">
                    No fraud rings detected yet
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Center Panel */}
          <div className="col-span-6 space-y-4">
            {/* Tab Switcher */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('graph')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'graph'
                    ? 'bg-[#FF444F] text-white'
                    : 'bg-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Knowledge Graph
              </button>
              <button
                onClick={() => setActiveTab('copilot')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'copilot'
                    ? 'bg-[#FF444F] text-white'
                    : 'bg-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <circle cx="12" cy="5" r="2"/>
                  <path d="M12 7v4"/>
                  <line x1="8" y1="16" x2="8" y2="16"/>
                  <line x1="16" y1="16" x2="16" y2="16"/>
                </svg>
                Investigation Copilot
              </button>
            </div>

            {/* Main Content Area */}
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

            {/* Selected Item Details */}
            {(selectedNode || selectedEdge || selectedRing || selectedAgent) && (
              <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
                {selectedNode && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">
                        Node: {selectedNode.label}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        selectedNode.riskScore >= 70 ? 'bg-red-500/20 text-red-400' :
                        selectedNode.riskScore >= 50 ? 'bg-orange-500/20 text-orange-400' :
                        selectedNode.riskScore >= 30 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        Risk: {selectedNode.riskScore}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Type:</div>
                      <div className="text-white capitalize">{selectedNode.type}</div>
                      {selectedNode.metadata.email && (
                        <>
                          <div className="text-gray-400">Email:</div>
                          <div className="text-white">{selectedNode.metadata.email}</div>
                        </>
                      )}
                      {selectedNode.metadata.contractType && (
                        <>
                          <div className="text-gray-400">Contract:</div>
                          <div className="text-white">{selectedNode.metadata.contractType}</div>
                        </>
                      )}
                      {selectedNode.metadata.amount && (
                        <>
                          <div className="text-gray-400">Amount:</div>
                          <div className="text-white">${selectedNode.metadata.amount}</div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white capitalize">
                        Edge: {selectedEdge.type.replace('_', ' ')}
                      </h3>
                      {selectedEdge.isFraudIndicator && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-500/20 text-red-400">
                          Fraud Indicator
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">Weight:</div>
                      <div className="text-white">{(selectedEdge.weight * 100).toFixed(0)}%</div>
                      {selectedEdge.metadata.confidence && (
                        <>
                          <div className="text-gray-400">Confidence:</div>
                          <div className="text-white">{selectedEdge.metadata.confidence}%</div>
                        </>
                      )}
                      {selectedEdge.metadata.description && (
                        <>
                          <div className="text-gray-400">Details:</div>
                          <div className="text-white">{selectedEdge.metadata.description}</div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedRing && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{selectedRing.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        selectedRing.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        selectedRing.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {selectedRing.severity.toUpperCase()}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                      <div className="p-2 bg-[rgba(255,255,255,0.05)] rounded">
                        <div className="text-white font-medium">{selectedRing.confidence}%</div>
                        <div className="text-xs text-gray-500">Confidence</div>
                      </div>
                      <div className="p-2 bg-[rgba(255,255,255,0.05)] rounded">
                        <div className="text-white font-medium">{selectedRing.entities.length}</div>
                        <div className="text-xs text-gray-500">Entities</div>
                      </div>
                      <div className="p-2 bg-[rgba(255,255,255,0.05)] rounded">
                        <div className="text-white font-medium">${selectedRing.exposure.toFixed(0)}</div>
                        <div className="text-xs text-gray-500">Exposure</div>
                      </div>
                    </div>

                    {/* AI Summary with markdown */}
                    {selectedRing.aiSummary && (
                      <div className="max-h-[300px] overflow-y-auto border-t border-white/10 pt-3">
                        <MarkdownContent content={selectedRing.aiSummary} />
                      </div>
                    )}
                  </div>
                )}

                {selectedAgent && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{selectedAgent.agentName}</h3>
                      <button
                        onClick={() => setSelectedAgent(null)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        ✕ Close
                      </button>
                    </div>

                    {/* Agent Summary with markdown */}
                    <div className="mb-4 pb-3 border-b border-white/10">
                      <MarkdownContent content={selectedAgent.summary} />
                    </div>

                    {/* Agent Findings */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      <div className="text-xs font-medium text-gray-400 mb-2">
                        Findings ({selectedAgent.findings.length})
                      </div>
                      {selectedAgent.findings.slice(0, 10).map((finding, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded border ${
                            finding.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                            finding.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                            finding.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            'bg-blue-500/10 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ${
                              finding.severity === 'critical' ? 'bg-red-500 text-white' :
                              finding.severity === 'high' ? 'bg-orange-500 text-white' :
                              finding.severity === 'medium' ? 'bg-yellow-500 text-black' :
                              'bg-blue-500 text-white'
                            }`}>
                              {finding.severity}
                            </span>
                            <span className="text-xs text-gray-400 capitalize">
                              {finding.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <MarkdownContent content={finding.description} />
                          {finding.entities && finding.entities.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              Entities: {finding.entities.slice(0, 3).join(', ')}
                              {finding.entities.length > 3 && ` +${finding.entities.length - 3} more`}
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedAgent.findings.length > 10 && (
                        <div className="text-xs text-gray-500 text-center py-2">
                          +{selectedAgent.findings.length - 10} more findings
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis Summary */}
            {analysis && (
              <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Analysis Summary</h2>
                <p className="text-sm text-gray-400">{analysis.summary}</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      analysis.overallRiskScore >= 70 ? 'bg-red-500' :
                      analysis.overallRiskScore >= 40 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <span className="text-sm text-white">
                      Overall Risk: {analysis.overallRiskScore}/100
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Analyzed at {new Date(analysis.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="col-span-3 space-y-4">
            {/* Alert Summary */}
            {analysis?.alerts && analysis.alerts.length > 0 && (
              <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
                <h2 className="text-sm font-semibold text-white mb-3">Alert Summary</h2>
                <AlertSummary alerts={analysis.alerts} />
              </div>
            )}

            {/* Live Alert Feed */}
            <div className="bg-[#161620] rounded-lg border border-[rgba(255,68,79,0.2)] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Live Feed</h2>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
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
  );
}
