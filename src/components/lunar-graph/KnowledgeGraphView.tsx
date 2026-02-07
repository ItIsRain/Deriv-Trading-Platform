'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { KnowledgeGraph, GraphNodeData, GraphEdgeData } from '@/types/lunar-graph';

interface KnowledgeGraphViewProps {
  graph: KnowledgeGraph | null;
  onNodeSelect?: (nodeId: string, nodeData: GraphNodeData) => void;
  onEdgeSelect?: (edgeId: string, edgeData: GraphEdgeData) => void;
  highlightedNodes?: string[];
  height?: number;
}

// Get color based on risk score
function getRiskColor(riskScore: number): string {
  if (riskScore >= 70) return '#ef4444';
  if (riskScore >= 50) return '#f97316';
  if (riskScore >= 30) return '#eab308';
  return '#22c55e';
}

// Get node size based on type
function getNodeSize(type: string): number {
  switch (type) {
    case 'affiliate': return 40;
    case 'client': return 30;
    case 'trade': return 20;
    case 'ip': return 35;
    case 'device': return 35;
    default: return 25;
  }
}

// Get edge color based on type
function getEdgeColor(type: string, isFraud: boolean): string {
  if (isFraud) return '#ef4444';
  switch (type) {
    case 'referral': return '#3b82f6';
    case 'ip_overlap': return '#f59e0b';
    case 'device_match': return '#8b5cf6';
    case 'timing_sync': return '#ec4899';
    case 'opposite_position': return '#ef4444';
    case 'trade_link': return '#6b7280';
    default: return '#9ca3af';
  }
}

export default function KnowledgeGraphView({
  graph,
  onNodeSelect,
  onEdgeSelect,
  highlightedNodes = [],
  height = 500,
}: KnowledgeGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const statusRef = useRef(status);
  statusRef.current = status;
  const initAttempts = useRef(0);

  // Store callbacks in refs
  const onNodeSelectRef = useRef(onNodeSelect);
  const onEdgeSelectRef = useRef(onEdgeSelect);
  onNodeSelectRef.current = onNodeSelect;
  onEdgeSelectRef.current = onEdgeSelect;

  // Initialize and update Cytoscape
  useEffect(() => {
    let cy: any = null;
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;
    let failsafeTimeout: NodeJS.Timeout;

    // Failsafe: if still loading after 8 seconds, show error
    failsafeTimeout = setTimeout(() => {
      if (isMounted && statusRef.current === 'loading') {
        console.error('[Graph] Failsafe timeout - forcing error state');
        setStatus('error');
      }
    }, 8000);

    const init = async () => {
      initAttempts.current++;

      // Give up after 3 attempts
      if (initAttempts.current > 3) {
        console.error('[Graph] Max attempts reached');
        if (isMounted) setStatus('error');
        return;
      }

      // Wait a tick to ensure container is mounted
      await new Promise(resolve => setTimeout(resolve, 50));

      if (!containerRef.current) {
        console.log('[Graph] No container ref, attempt', initAttempts.current);
        // Retry after a short delay
        retryTimeout = setTimeout(init, 300);
        return;
      }

      try {
        console.log('[Graph] Loading Cytoscape...');

        // Dynamic import with timeout
        const cytoscapePromise = import('cytoscape');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cytoscape load timeout')), 10000)
        );

        const cytoscapeModule = await Promise.race([cytoscapePromise, timeoutPromise]) as any;
        const cytoscape = cytoscapeModule.default;

        if (!isMounted) {
          console.log('[Graph] Component unmounted during init');
          return;
        }

        if (!containerRef.current) {
          console.log('[Graph] Container ref lost');
          if (isMounted) setStatus('error');
          return;
        }

        console.log('[Graph] Creating Cytoscape instance...');

        // Create instance
        cy = cytoscape({
          container: containerRef.current,
          elements: [],
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'width': 'data(size)',
                'height': 'data(size)',
                'font-size': '10px',
                'color': '#fff',
                'text-valign': 'bottom',
                'text-margin-y': 5,
                'border-width': 2,
                'border-color': 'data(borderColor)',
                'text-outline-width': 1,
                'text-outline-color': '#000',
              } as any,
            },
            {
              selector: 'node.highlighted',
              style: {
                'border-width': 4,
                'border-color': '#22d3ee',
              },
            },
            {
              selector: 'edge',
              style: {
                'width': 'data(width)',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'opacity': 0.7,
              } as any,
            },
            {
              selector: 'edge.fraud',
              style: {
                'line-style': 'dashed',
                'width': 2,
              },
            },
          ],
          minZoom: 0.1,
          maxZoom: 4,
          wheelSensitivity: 0.2,
        });

        // Event handlers
        cy.on('tap', 'node', (e: any) => {
          const data = e.target.data();
          if (onNodeSelectRef.current && data.originalData) {
            onNodeSelectRef.current(data.id, data.originalData);
          }
        });

        cy.on('tap', 'edge', (e: any) => {
          const data = e.target.data();
          if (onEdgeSelectRef.current && data.originalData) {
            onEdgeSelectRef.current(data.id, data.originalData);
          }
        });

        cyInstanceRef.current = cy;
        setStatus('ready');
        console.log('[Graph] Cytoscape ready');

        // If graph data exists, render it
        if (graph && graph.nodes.length > 0) {
          renderGraph(cy, graph);
        }
      } catch (err) {
        console.error('[Graph] Init error:', err);
        if (isMounted) setStatus('error');
      }
    };

    init();

    return () => {
      isMounted = false;
      clearTimeout(retryTimeout);
      clearTimeout(failsafeTimeout);
      if (cy) {
        cy.destroy();
        cyInstanceRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Render graph data
  const renderGraph = useCallback((cy: any, graphData: KnowledgeGraph) => {
    if (!cy || !graphData) return;

    console.log('[Graph] Rendering:', graphData.stats.totalNodes, 'nodes');

    cy.elements().remove();

    if (graphData.nodes.length === 0) return;

    // Add nodes
    const nodes = graphData.nodes.map((node) => ({
      group: 'nodes' as const,
      data: {
        id: node.id,
        label: node.label.length > 12 ? node.label.slice(0, 10) + '..' : node.label,
        color: getRiskColor(node.riskScore),
        size: getNodeSize(node.type),
        borderColor: node.riskScore >= 50 ? '#ef4444' : '#333',
        originalData: node,
      },
    }));

    // Add edges
    const nodeIds = new Set(graphData.nodes.map(n => n.id));
    const edges = graphData.edges
      .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((edge) => ({
        group: 'edges' as const,
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          color: getEdgeColor(edge.type, edge.isFraudIndicator),
          width: edge.isFraudIndicator ? 2 : 1,
          originalData: edge,
        },
        classes: edge.isFraudIndicator ? 'fraud' : '',
      }));

    cy.add([...nodes, ...edges]);

    // Layout
    cy.layout({
      name: 'cose',
      animate: false,
      fit: true,
      padding: 40,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 100,
      gravity: 0.25,
      numIter: 300,
    } as any).run();

    setTimeout(() => {
      cy.fit(undefined, 30);
    }, 50);
  }, []);

  // Update graph when data changes
  useEffect(() => {
    const cy = cyInstanceRef.current;
    if (cy && status === 'ready' && graph) {
      renderGraph(cy, graph);
    }
  }, [graph, status, renderGraph]);

  // Handle highlighted nodes
  useEffect(() => {
    const cy = cyInstanceRef.current;
    if (!cy || status !== 'ready') return;

    cy.nodes().removeClass('highlighted');
    highlightedNodes.forEach((id) => {
      const node = cy.getElementById(id);
      if (node.length) node.addClass('highlighted');
    });
  }, [highlightedNodes, status]);

  const handleFit = useCallback(() => {
    cyInstanceRef.current?.fit(undefined, 30);
  }, []);

  const handleFocusRisk = useCallback(() => {
    const cy = cyInstanceRef.current;
    if (!cy || !graph) return;

    const highRisk = graph.nodes.filter(n => n.riskScore >= 50).map(n => n.id);
    if (highRisk.length > 0) {
      const col = cy.collection();
      highRisk.forEach((id: string) => {
        const node = cy.getElementById(id);
        if (node.length) col.merge(node);
      });
      if (col.length) cy.fit(col, 50);
    }
  }, [graph]);

  return (
    <div className="relative">
      {/* Graph container - always render so ref is available */}
      <div
        ref={containerRef}
        className="bg-[#0a0a0f] rounded-lg border border-[rgba(255,68,79,0.2)]"
        style={{ height, width: '100%' }}
      />

      {/* No graph data overlay */}
      {!graph && status === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f] rounded-lg">
          <div className="text-center text-gray-400">
            <div className="flex justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="5" cy="6" r="2"/>
                <circle cx="19" cy="6" r="2"/>
                <circle cx="5" cy="18" r="2"/>
                <circle cx="19" cy="18" r="2"/>
                <path d="M10 9 L6 7"/>
                <path d="M14 9 L18 7"/>
                <path d="M10 15 L6 17"/>
                <path d="M14 15 L18 17"/>
              </svg>
            </div>
            <p className="mb-2 text-white font-medium">No graph data</p>
            <p className="text-sm">Click "Build Graph" to construct the knowledge graph</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/90 rounded-lg">
          <div className="text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
            <p>Initializing graph...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0f]/90 rounded-lg">
          <div className="text-center text-red-400">
            <p>Failed to initialize graph</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm underline">
              Reload page
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      {status === 'ready' && graph && (
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <button
            onClick={handleFit}
            className="px-3 py-1.5 text-xs bg-white/15 hover:bg-white/25 text-white rounded transition-colors"
          >
            Fit View
          </button>
          <button
            onClick={handleFocusRisk}
            className="px-3 py-1.5 text-xs bg-red-500/30 hover:bg-red-500/50 text-red-300 rounded transition-colors"
          >
            Focus Risk
          </button>
        </div>
      )}

      {/* Legend - only show when graph exists */}
      {graph && (
        <div className="absolute bottom-3 left-3 bg-black/85 rounded-lg p-3 text-xs z-10">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-300">Low Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-300">Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-gray-300">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-300">Critical</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-6 border-t-2 border-dashed border-red-500" />
              <span className="text-gray-300">Fraud Edge</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats - only show when graph exists */}
      {graph && (
        <div className="absolute top-3 left-3 bg-black/85 rounded-lg px-3 py-2 text-xs z-10">
          <div className="text-gray-300">
            <span className="text-white font-semibold">{graph.stats.totalNodes}</span> nodes |{' '}
            <span className="text-white font-semibold">{graph.stats.totalEdges}</span> edges |{' '}
            <span className="text-red-400 font-semibold">{graph.stats.fraudEdges}</span> fraud
          </div>
        </div>
      )}
    </div>
  );
}
