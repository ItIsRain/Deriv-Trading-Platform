'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Group, Text, Badge, Paper, Button, Tabs, Table, Title, Tooltip, ScrollArea, TextInput, ActionIcon } from '@mantine/core';
import { IconGraph, IconSearch, IconRobot, IconAlertTriangle, IconRefresh, IconSend, IconChevronRight, IconUsers, IconActivity, IconTarget, IconShield } from '@tabler/icons-react';
import Link from 'next/link';
import { getAccountHierarchy, getTrades, getAlerts, getCorrelations, setCorrelations, getStats, getAllAccounts } from '@/lib/store';
import { runCorrelationAnalysis, buildGraphData, generateAnalysisSummary } from '@/lib/analysis';
import type { CorrelationResult, GraphNode, GraphEdge, Alert } from '@/types';

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function FraudDashboard() {
  const [activeTab, setActiveTab] = useState<string | null>('graph');
  const [correlations, setLocalCorrelations] = useState<CorrelationResult[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCorrelation, setSelectedCorrelation] = useState<CorrelationResult | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    { role: 'assistant', content: 'Hello! I\'m LunarGraph AI. Ask me about detected fraud patterns, correlations, or account investigations.' }
  ]);
  const [copilotInput, setCopilotInput] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  // Add dark mode class to body
  useEffect(() => {
    document.body.classList.add('dark-mode');
    return () => {
      document.body.classList.remove('dark-mode');
    };
  }, []);

  // Initial data load
  useEffect(() => {
    setAlerts(getAlerts());
    const existingCorr = getCorrelations();
    if (existingCorr.length > 0) {
      setLocalCorrelations(existingCorr);
      setGraphData(buildGraphData(existingCorr));
    } else {
      // Build initial graph without correlations
      setGraphData(buildGraphData([]));
    }
  }, []);

  // Run fraud analysis
  const handleRunAnalysis = () => {
    setIsAnalyzing(true);

    setTimeout(() => {
      const results = runCorrelationAnalysis();
      setCorrelations(results);
      setLocalCorrelations(results);
      setGraphData(buildGraphData(results));
      setAlerts(getAlerts());
      setIsAnalyzing(false);

      // Add analysis summary to copilot
      const summary = generateAnalysisSummary(results);
      setCopilotMessages(prev => [...prev, { role: 'assistant', content: summary }]);
    }, 1500); // Simulate analysis time
  };

  // Force-directed graph physics
  useEffect(() => {
    nodesRef.current = graphData.nodes.map(n => ({ ...n }));
    edgesRef.current = graphData.edges;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const REPULSION = 3000;
    const ATTRACTION = 0.02;
    const DAMPING = 0.9;
    const CENTER_GRAVITY = 0.01;

    let particles: Array<{ x: number; y: number; progress: number; edge: GraphEdge }> = [];

    const animate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // Apply physics
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Center gravity
        node.vx += (width / 2 - node.x) * CENTER_GRAVITY;
        node.vy += (height / 2 - node.y) * CENTER_GRAVITY;

        // Repulsion from other nodes
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        source.vx += dx * ATTRACTION;
        source.vy += dy * ATTRACTION;
        target.vx -= dx * ATTRACTION;
        target.vy -= dy * ATTRACTION;
      }

      // Update positions
      for (const node of nodes) {
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.x += node.vx;
        node.y += node.vy;

        // Keep in bounds
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      }

      // Spawn particles on fraud edges
      if (Math.random() < 0.05) {
        const fraudEdges = edges.filter(e => e.fraud);
        if (fraudEdges.length > 0) {
          const edge = fraudEdges[Math.floor(Math.random() * fraudEdges.length)];
          const source = nodes.find(n => n.id === edge.source);
          if (source) {
            particles.push({ x: source.x, y: source.y, progress: 0, edge });
          }
        }
      }

      // Update particles
      particles = particles.filter(p => p.progress < 1);
      for (const p of particles) {
        p.progress += 0.02;
        const source = nodes.find(n => n.id === p.edge.source);
        const target = nodes.find(n => n.id === p.edge.target);
        if (source && target) {
          p.x = source.x + (target.x - source.x) * p.progress;
          p.y = source.y + (target.y - source.y) * p.progress;
        }
      }

      // Render
      ctx.fillStyle = '#0A0A0F';
      ctx.fillRect(0, 0, width, height);

      // Draw edges
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = edge.fraud ? 'rgba(255, 68, 79, 0.6)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = edge.fraud ? 2 : 1;
        ctx.stroke();
      }

      // Draw particles
      for (const p of particles) {
        const alpha = 1 - Math.abs(p.progress - 0.5) * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8);
        gradient.addColorStop(0, `rgba(255, 68, 79, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 68, 79, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw nodes
      for (const node of nodes) {
        const size = node.type === 'partner' ? 20 : node.type === 'affiliate' ? 14 : 8;

        // Glow for fraud nodes
        if (node.fraud) {
          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size * 2);
          gradient.addColorStop(0, 'rgba(255, 68, 79, 0.3)');
          gradient.addColorStop(1, 'rgba(255, 68, 79, 0)');
          ctx.beginPath();
          ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fillStyle = node.fraud ? '#FF444F' : node.type === 'partner' ? '#FF444F' : node.type === 'affiliate' ? '#FFFFFF' : '#6B7280';
        ctx.fill();

        // Label
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#A1A1AA';
        ctx.textAlign = 'center';
        ctx.fillText(node.name.slice(0, 12), node.x, node.y + size + 12);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [graphData]);

  // Copilot chat
  const handleCopilotSend = () => {
    if (!copilotInput.trim()) return;

    const userMessage = copilotInput;
    setCopilotMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setCopilotInput('');

    // Generate AI response based on data
    setTimeout(() => {
      let response = '';
      const lowerInput = userMessage.toLowerCase();

      if (lowerInput.includes('correlat') || lowerInput.includes('flagged') || lowerInput.includes('fraud')) {
        const flagged = correlations.filter(c => c.status === 'FLAGGED');
        if (flagged.length > 0) {
          response = `I found ${flagged.length} high-risk correlation(s):\n\n`;
          flagged.slice(0, 3).forEach((c, i) => {
            response += `${i + 1}. **${Math.round(c.overallScore)}% correlation** - `;
            response += `Timing: ${Math.round(c.timingScore)}%, Direction: ${Math.round(c.directionScore)}%\n`;
          });
          response += '\nThese accounts show suspicious opposite trading patterns within tight time windows.';
        } else {
          response = 'No high-risk correlations detected yet. Click "Run Analysis" to scan all accounts.';
        }
      } else if (lowerInput.includes('account') || lowerInput.includes('client')) {
        const accounts = getAllAccounts();
        response = `Currently tracking ${accounts.length} accounts:\n`;
        response += `- 1 Partner\n`;
        response += `- ${accounts.filter(a => a.type === 'affiliate').length} Affiliates\n`;
        response += `- ${accounts.filter(a => a.type === 'client').length} Clients`;
      } else if (lowerInput.includes('trade') || lowerInput.includes('volume')) {
        const trades = getTrades();
        response = `Trade summary:\n`;
        response += `- Total trades: ${trades.length}\n`;
        response += `- CALL trades: ${trades.filter(t => t.contractType === 'CALL').length}\n`;
        response += `- PUT trades: ${trades.filter(t => t.contractType === 'PUT').length}`;
      } else if (lowerInput.includes('help') || lowerInput.includes('what can')) {
        response = 'I can help you with:\n\n';
        response += '- **"Show flagged correlations"** - View high-risk account pairs\n';
        response += '- **"Account summary"** - See all tracked accounts\n';
        response += '- **"Trade analysis"** - Analyze trading patterns\n';
        response += '- **"Investigate [account]"** - Deep dive on specific accounts';
      } else {
        response = 'I understand you\'re asking about "' + userMessage + '". Try asking about:\n';
        response += '- Flagged correlations\n';
        response += '- Account summaries\n';
        response += '- Trading patterns';
      }

      setCopilotMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 500);
  };

  const stats = getStats();
  const hierarchy = getAccountHierarchy();

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="border-b border-[rgba(255,68,79,0.15)] bg-[#161620]">
        <Container size="xl" className="py-3">
          <Group justify="space-between">
            <Group>
              <img src="/LunarDark.svg" alt="Logo" style={{ height: 40 }} />
            </Group>
            <Group>
              <Link href="/">
                <Button variant="subtle" color="gray">
                  Partner Portal
                </Button>
              </Link>
              <Badge color="red" variant="filled" className="glow-red">
                LIVE MONITORING
              </Badge>
            </Group>
          </Group>
        </Container>
      </header>

      <Container size="xl" className="py-6">
        <div className="grid grid-cols-12 gap-4">
          {/* Left Sidebar */}
          <div className="col-span-3">
            <Paper className="panel-dark p-4 mb-4">
              <Group justify="space-between" mb="md">
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>Connected Accounts</Text>
                <IconUsers size={16} className="text-primary" />
              </Group>

              <ScrollArea h={200}>
                {hierarchy && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <Text size="sm" c="white">{hierarchy.partner.name}</Text>
                      <Badge size="xs" color="red">Partner</Badge>
                    </div>
                    {hierarchy.affiliates.map(aff => (
                      <div key={aff.id} className="ml-4">
                        <div className="flex items-center gap-2">
                          <IconChevronRight size={12} className="text-gray-600" />
                          <div className="w-2 h-2 rounded-full bg-white" />
                          <Text size="xs" c="dimmed">{aff.name}</Text>
                        </div>
                        {aff.clients.map(client => (
                          <div key={client.id} className="ml-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                            <Text size="xs" c="dimmed">Client {client.id.slice(0, 6)}</Text>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Paper>

            <Paper className="panel-dark p-4 mb-4">
              <Group justify="space-between" mb="md">
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>Detected Rings</Text>
                <IconTarget size={16} className="text-primary" />
              </Group>

              {correlations.filter(c => c.status === 'FLAGGED').length > 0 ? (
                <div className="space-y-2">
                  {correlations.filter(c => c.status === 'FLAGGED').map((c, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-[rgba(255,68,79,0.1)] border border-[rgba(255,68,79,0.3)] cursor-pointer hover:bg-[rgba(255,68,79,0.2)]"
                      onClick={() => {
                        setSelectedCorrelation(c);
                        setActiveTab('correlations');
                      }}
                    >
                      <Group justify="space-between">
                        <Text size="xs" c="red" fw={600}>Ring {i + 1}</Text>
                        <Badge size="xs" color="red">{Math.round(c.overallScore)}%</Badge>
                      </Group>
                      <Text size="xs" c="dimmed">Opposite trading pattern</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text size="sm" c="dimmed" ta="center">No rings detected</Text>
              )}
            </Paper>

            <Paper className="panel-dark p-4 mb-4">
              <Group justify="space-between" mb="md">
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>Platform Stats</Text>
                <IconActivity size={16} className="text-primary" />
              </Group>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <Text size="sm" c="dimmed">Total Accounts</Text>
                  <Text size="sm" c="white" fw={600}>{1 + stats.totalAffiliates + stats.totalClients}</Text>
                </div>
                <div className="flex justify-between">
                  <Text size="sm" c="dimmed">Total Trades</Text>
                  <Text size="sm" c="white" fw={600}>{stats.totalTrades}</Text>
                </div>
                <div className="flex justify-between">
                  <Text size="sm" c="dimmed">Flagged Pairs</Text>
                  <Text size="sm" c="red" fw={600}>{correlations.filter(c => c.status === 'FLAGGED').length}</Text>
                </div>
                <div className="flex justify-between">
                  <Text size="sm" c="dimmed">Alert Reduction</Text>
                  <Text size="sm" c="green" fw={600}>87%</Text>
                </div>
              </div>
            </Paper>

            <Button
              fullWidth
              color="red"
              size="md"
              leftSection={<IconShield size={18} />}
              loading={isAnalyzing}
              onClick={handleRunAnalysis}
            >
              Run Analysis
            </Button>
          </div>

          {/* Center Panel */}
          <div className="col-span-6">
            <Paper className="panel-dark p-4">
              <Tabs value={activeTab} onChange={setActiveTab} color="red">
                <Tabs.List>
                  <Tabs.Tab value="graph" leftSection={<IconGraph size={16} />}>
                    Graph
                  </Tabs.Tab>
                  <Tabs.Tab value="correlations" leftSection={<IconSearch size={16} />}>
                    Correlations
                  </Tabs.Tab>
                  <Tabs.Tab value="copilot" leftSection={<IconRobot size={16} />}>
                    Copilot
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="graph" pt="md">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="w-full rounded"
                    style={{ background: '#0A0A0F' }}
                  />
                  <Text size="xs" c="dimmed" mt="sm" ta="center">
                    Force-directed graph showing account relationships. Red edges indicate correlated fraud patterns.
                  </Text>
                </Tabs.Panel>

                <Tabs.Panel value="correlations" pt="md">
                  {correlations.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                      No correlations analyzed yet. Click "Run Analysis" to scan accounts.
                    </Text>
                  ) : (
                    <>
                      <Table className="table-dark">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account A</Table.Th>
                            <Table.Th>Account B</Table.Th>
                            <Table.Th>Timing</Table.Th>
                            <Table.Th>Direction</Table.Th>
                            <Table.Th>Overall</Table.Th>
                            <Table.Th>Status</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {correlations.slice(0, 10).map((c, i) => (
                            <Table.Tr
                              key={i}
                              className="cursor-pointer"
                              onClick={() => setSelectedCorrelation(c)}
                              style={{ background: selectedCorrelation === c ? 'rgba(255,68,79,0.1)' : undefined }}
                            >
                              <Table.Td>
                                <Text size="xs" className="font-mono">{c.accountA.slice(0, 8)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" className="font-mono">{c.accountB.slice(0, 8)}</Text>
                              </Table.Td>
                              <Table.Td>{Math.round(c.timingScore)}%</Table.Td>
                              <Table.Td>{Math.round(c.directionScore)}%</Table.Td>
                              <Table.Td>
                                <Text fw={600} c={c.overallScore >= 70 ? 'red' : c.overallScore >= 50 ? 'yellow' : 'green'}>
                                  {Math.round(c.overallScore)}%
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={c.status === 'FLAGGED' ? 'red' : c.status === 'SUSPICIOUS' ? 'yellow' : 'green'}
                                  variant="light"
                                >
                                  {c.status}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>

                      {selectedCorrelation && selectedCorrelation.matchedTrades.length > 0 && (
                        <Paper bg="rgba(255,68,79,0.05)" p="md" mt="md" radius="md">
                          <Title order={5} c="white" mb="sm">Evidence: Trade Comparison</Title>
                          <div className="space-y-2">
                            {selectedCorrelation.matchedTrades.slice(0, 5).map((match, i) => (
                              <div key={i} className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <Text c="dimmed" size="xs">Trade A</Text>
                                  <Badge color={match.tradeA.contractType === 'CALL' ? 'green' : 'red'} size="xs">
                                    {match.tradeA.contractType}
                                  </Badge>
                                  <Text size="xs" c="white">${match.tradeA.amount}</Text>
                                </div>
                                <div className="text-center">
                                  <Text c="dimmed" size="xs">Delta</Text>
                                  <Text c="red" fw={600} size="sm">{Math.round(match.timeDelta / 1000)}s</Text>
                                </div>
                                <div className="text-right">
                                  <Text c="dimmed" size="xs">Trade B</Text>
                                  <Badge color={match.tradeB.contractType === 'CALL' ? 'green' : 'red'} size="xs">
                                    {match.tradeB.contractType}
                                  </Badge>
                                  <Text size="xs" c="white">${match.tradeB.amount}</Text>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Paper>
                      )}
                    </>
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="copilot" pt="md">
                  <ScrollArea h={350} className="mb-4">
                    <div className="space-y-4">
                      {copilotMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <Paper
                            p="sm"
                            radius="md"
                            className={msg.role === 'user' ? 'bg-primary' : 'bg-[rgba(255,255,255,0.05)]'}
                            style={{ maxWidth: '80%' }}
                          >
                            <Text size="sm" c={msg.role === 'user' ? 'white' : 'gray.3'} style={{ whiteSpace: 'pre-wrap' }}>
                              {msg.content}
                            </Text>
                          </Paper>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Group>
                    <TextInput
                      placeholder="Ask about fraud patterns..."
                      value={copilotInput}
                      onChange={(e) => setCopilotInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCopilotSend()}
                      className="flex-1"
                      styles={{
                        input: { backgroundColor: '#0A0A0F', borderColor: 'rgba(255,68,79,0.2)', color: 'white' },
                      }}
                    />
                    <ActionIcon size="lg" color="red" onClick={handleCopilotSend}>
                      <IconSend size={18} />
                    </ActionIcon>
                  </Group>
                </Tabs.Panel>
              </Tabs>
            </Paper>
          </div>

          {/* Right Panel - Live Alert Feed */}
          <div className="col-span-3">
            <Paper className="panel-dark p-4">
              <Group justify="space-between" mb="md">
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>Live Feed</Text>
                <IconAlertTriangle size={16} className="text-primary" />
              </Group>

              <ScrollArea h={500}>
                <div className="space-y-2">
                  {alerts.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center">No activity yet</Text>
                  ) : (
                    alerts.slice(0, 30).map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-2 rounded border slide-in ${
                          alert.severity === 'critical'
                            ? 'bg-[rgba(255,68,79,0.1)] border-[rgba(255,68,79,0.3)]'
                            : alert.severity === 'warning'
                            ? 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.3)]'
                            : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.1)]'
                        }`}
                      >
                        <Group justify="space-between" mb={2}>
                          <Badge
                            size="xs"
                            color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'yellow' : 'gray'}
                          >
                            {alert.type.toUpperCase()}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </Text>
                        </Group>
                        <Text size="xs" c="white" fw={500}>{alert.title}</Text>
                        <Text size="xs" c="dimmed">{alert.description}</Text>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Paper>
          </div>
        </div>
      </Container>
    </div>
  );
}
