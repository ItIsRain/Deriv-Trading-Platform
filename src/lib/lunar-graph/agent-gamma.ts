// Agent Gamma - Transaction Pattern Analysis
// Detects trading fraud patterns and commission anomalies

import {
  KnowledgeGraph,
  AgentAnalysis,
  AgentFinding,
  FraudSeverity,
} from '@/types/lunar-graph';
import { openRouterClient } from './openrouter-client';
import { v4 as uuidv4 } from 'uuid';

const AGENT_NAME = 'Agent Gamma';
const AGENT_TYPE = 'gamma';

// ============ OPPOSITE TRADING DETECTION ============

interface OppositeTradePair {
  tradeA: {
    id: string;
    accountId: string;
    type: 'CALL' | 'PUT';
    amount: number;
    timestamp: Date;
    symbol: string;
  };
  tradeB: {
    id: string;
    accountId: string;
    type: 'CALL' | 'PUT';
    amount: number;
    timestamp: Date;
    symbol: string;
  };
  timeDelta: number;
  amountRatio: number;
  fraudScore: number;
}

function detectOppositeTrading(graph: KnowledgeGraph): OppositeTradePair[] {
  const pairs: OppositeTradePair[] = [];

  // Get opposite_position edges
  const oppositeEdges = graph.edges.filter(e => e.type === 'opposite_position');

  for (const edge of oppositeEdges) {
    const tradeANode = graph.nodes.find(n => n.id === edge.source);
    const tradeBNode = graph.nodes.find(n => n.id === edge.target);

    if (!tradeANode || !tradeBNode) continue;

    // Find the accounts for each trade
    const tradeALinks = graph.edges.filter(e => e.target === edge.source && e.type === 'trade_link');
    const tradeBLinks = graph.edges.filter(e => e.target === edge.target && e.type === 'trade_link');

    const accountA = tradeALinks[0]?.source;
    const accountB = tradeBLinks[0]?.source;

    if (!accountA || !accountB) continue;

    const amountA = tradeANode.metadata.amount || 0;
    const amountB = tradeBNode.metadata.amount || 0;
    const amountRatio = Math.min(amountA, amountB) / Math.max(amountA, amountB);

    // Calculate fraud score
    let fraudScore = 50; // Base score

    // Closer amounts = higher fraud score
    fraudScore += amountRatio * 20;

    // Tighter timing = higher fraud score
    const timeDelta = edge.metadata.timeDelta || 10000;
    if (timeDelta < 1000) fraudScore += 20;
    else if (timeDelta < 3000) fraudScore += 15;
    else if (timeDelta < 5000) fraudScore += 10;

    pairs.push({
      tradeA: {
        id: edge.source,
        accountId: accountA,
        type: tradeANode.metadata.contractType as 'CALL' | 'PUT',
        amount: amountA,
        timestamp: new Date(tradeANode.metadata.timestamp || ''),
        symbol: tradeANode.metadata.symbol || '',
      },
      tradeB: {
        id: edge.target,
        accountId: accountB,
        type: tradeBNode.metadata.contractType as 'CALL' | 'PUT',
        amount: amountB,
        timestamp: new Date(tradeBNode.metadata.timestamp || ''),
        symbol: tradeBNode.metadata.symbol || '',
      },
      timeDelta,
      amountRatio,
      fraudScore: Math.min(100, fraudScore),
    });
  }

  return pairs.sort((a, b) => b.fraudScore - a.fraudScore);
}

// ============ COMMISSION ANOMALY DETECTION ============

interface CommissionAnomaly {
  accountId: string;
  accountLabel: string;
  anomalyType: 'high_volume_low_value' | 'unusual_pattern' | 'rapid_churn';
  description: string;
  severity: FraudSeverity;
  metrics: {
    tradeCount: number;
    avgAmount: number;
    totalVolume: number;
    estimatedCommission: number;
  };
}

function detectCommissionAnomalies(graph: KnowledgeGraph): CommissionAnomaly[] {
  const anomalies: CommissionAnomaly[] = [];
  const COMMISSION_RATE = 0.045; // 4.5%

  // Group trades by account
  const tradesByAccount: Record<string, Array<{ amount: number; profit: number }>> = {};

  for (const node of graph.nodes) {
    if (node.type === 'trade') {
      const links = graph.edges.filter(e => e.target === node.id && e.type === 'trade_link');
      for (const link of links) {
        if (!tradesByAccount[link.source]) {
          tradesByAccount[link.source] = [];
        }
        tradesByAccount[link.source].push({
          amount: node.metadata.amount || 0,
          profit: node.metadata.profit || 0,
        });
      }
    }
  }

  // Analyze each account
  for (const [accountId, trades] of Object.entries(tradesByAccount)) {
    if (trades.length < 3) continue;

    const accountNode = graph.nodes.find(n => n.id === accountId);
    const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount = totalVolume / trades.length;
    const estimatedCommission = totalVolume * COMMISSION_RATE;

    // Detect high volume, low value (commission pumping)
    if (trades.length >= 10 && avgAmount < 5) {
      anomalies.push({
        accountId,
        accountLabel: accountNode?.label || accountId,
        anomalyType: 'high_volume_low_value',
        description: `${trades.length} trades with average value of $${avgAmount.toFixed(2)} - potential commission pumping`,
        severity: trades.length >= 20 ? 'high' : 'medium',
        metrics: {
          tradeCount: trades.length,
          avgAmount,
          totalVolume,
          estimatedCommission,
        },
      });
    }

    // Detect rapid churn (many trades in short period)
    // This would need timestamps which we calculate from the graph
    if (trades.length >= 15) {
      const tradeNodes = graph.nodes.filter(
        n => n.type === 'trade' &&
        graph.edges.some(e => e.source === accountId && e.target === n.id && e.type === 'trade_link')
      );

      if (tradeNodes.length >= 15) {
        const timestamps = tradeNodes
          .map(n => new Date(n.metadata.timestamp || '').getTime())
          .filter(t => !isNaN(t))
          .sort((a, b) => a - b);

        if (timestamps.length >= 10) {
          const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
          const tradesPerHour = (timestamps.length / timeSpan) * 3600000;

          if (tradesPerHour > 20) {
            anomalies.push({
              accountId,
              accountLabel: accountNode?.label || accountId,
              anomalyType: 'rapid_churn',
              description: `${tradesPerHour.toFixed(1)} trades per hour - unusually high activity`,
              severity: 'high',
              metrics: {
                tradeCount: trades.length,
                avgAmount,
                totalVolume,
                estimatedCommission,
              },
            });
          }
        }
      }
    }

    // Detect unusual win/loss patterns
    const winCount = trades.filter(t => (t.profit || 0) > 0).length;
    const lossCount = trades.filter(t => (t.profit || 0) < 0).length;

    if (trades.length >= 10) {
      const winRate = winCount / trades.length;

      // Suspiciously high win rate (possible manipulation)
      if (winRate >= 0.9) {
        anomalies.push({
          accountId,
          accountLabel: accountNode?.label || accountId,
          anomalyType: 'unusual_pattern',
          description: `${(winRate * 100).toFixed(0)}% win rate across ${trades.length} trades - statistically unusual`,
          severity: 'high',
          metrics: {
            tradeCount: trades.length,
            avgAmount,
            totalVolume,
            estimatedCommission,
          },
        });
      }

      // Always losing (possible reverse strategy with coordination)
      if (lossCount > 0 && winCount === 0 && trades.length >= 5) {
        anomalies.push({
          accountId,
          accountLabel: accountNode?.label || accountId,
          anomalyType: 'unusual_pattern',
          description: `100% loss rate across ${trades.length} trades - check for coordinated opposite account`,
          severity: 'critical',
          metrics: {
            tradeCount: trades.length,
            avgAmount,
            totalVolume,
            estimatedCommission,
          },
        });
      }
    }
  }

  return anomalies.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ============ WIN/LOSS RATIO ANALYSIS ============

interface WinLossAnalysis {
  accountId: string;
  accountLabel: string;
  winRate: number;
  lossRate: number;
  tradeCount: number;
  netProfit: number;
  suspicionLevel: FraudSeverity;
  notes: string[];
}

function analyzeWinLossRatios(graph: KnowledgeGraph): WinLossAnalysis[] {
  const analyses: WinLossAnalysis[] = [];

  // Group trades by account
  const tradesByAccount: Record<string, Array<{ profit: number; amount: number }>> = {};

  for (const node of graph.nodes) {
    if (node.type === 'trade') {
      const links = graph.edges.filter(e => e.target === node.id && e.type === 'trade_link');
      for (const link of links) {
        if (!tradesByAccount[link.source]) {
          tradesByAccount[link.source] = [];
        }
        tradesByAccount[link.source].push({
          profit: node.metadata.profit || 0,
          amount: node.metadata.amount || 0,
        });
      }
    }
  }

  for (const [accountId, trades] of Object.entries(tradesByAccount)) {
    if (trades.length < 5) continue;

    const accountNode = graph.nodes.find(n => n.id === accountId);
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    const netProfit = trades.reduce((sum, t) => sum + t.profit, 0);

    const winRate = wins.length / trades.length;
    const lossRate = losses.length / trades.length;

    const notes: string[] = [];
    let suspicionLevel: FraudSeverity = 'low';

    // Analyze patterns
    if (winRate >= 0.85) {
      notes.push('Unusually high win rate');
      suspicionLevel = 'high';
    }

    if (lossRate >= 0.85) {
      notes.push('Consistently losing - check for coordinated partner');
      suspicionLevel = 'critical';
    }

    // Check for exact 50/50 split (potential coordination)
    if (Math.abs(winRate - 0.5) < 0.05 && trades.length >= 10) {
      notes.push('Suspiciously even win/loss split');
      suspicionLevel = suspicionLevel === 'low' ? 'medium' : suspicionLevel;
    }

    // Check for profit manipulation
    const avgWinProfit = wins.length > 0 ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
    const avgLossAmount = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length) : 0;

    if (avgWinProfit > avgLossAmount * 3) {
      notes.push('Wins significantly larger than losses');
    }

    if (notes.length > 0) {
      analyses.push({
        accountId,
        accountLabel: accountNode?.label || accountId,
        winRate,
        lossRate,
        tradeCount: trades.length,
        netProfit,
        suspicionLevel,
        notes,
      });
    }
  }

  return analyses.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.suspicionLevel] - order[b.suspicionLevel];
  });
}

// ============ FINDINGS GENERATION ============

function generateFindings(
  oppositePairs: OppositeTradePair[],
  commissionAnomalies: CommissionAnomaly[],
  winLossAnalyses: WinLossAnalysis[],
  graph: KnowledgeGraph
): AgentFinding[] {
  const findings: AgentFinding[] = [];

  // Opposite trading findings
  for (const pair of oppositePairs.slice(0, 5)) {
    const accountANode = graph.nodes.find(n => n.id === pair.tradeA.accountId);
    const accountBNode = graph.nodes.find(n => n.id === pair.tradeB.accountId);

    findings.push({
      id: uuidv4(),
      type: 'opposite_trading',
      severity: pair.fraudScore >= 85 ? 'critical' : pair.fraudScore >= 70 ? 'high' : 'medium',
      title: `Opposite Trading Detected: ${pair.tradeA.symbol}`,
      description: `${accountANode?.label || pair.tradeA.accountId} (${pair.tradeA.type}) vs ${accountBNode?.label || pair.tradeB.accountId} (${pair.tradeB.type}) - ${pair.timeDelta}ms apart`,
      confidence: Math.round(pair.fraudScore),
      entities: [pair.tradeA.accountId, pair.tradeB.accountId, pair.tradeA.id, pair.tradeB.id],
      evidence: [
        `Time delta: ${pair.timeDelta}ms`,
        `Amount ratio: ${(pair.amountRatio * 100).toFixed(1)}%`,
        `Trade A: ${pair.tradeA.type} $${pair.tradeA.amount}`,
        `Trade B: ${pair.tradeB.type} $${pair.tradeB.amount}`,
        `Symbol: ${pair.tradeA.symbol}`,
      ],
      suggestedAction: 'Investigate account relationship and freeze suspicious accounts',
    });
  }

  // Commission anomaly findings
  for (const anomaly of commissionAnomalies.slice(0, 5)) {
    findings.push({
      id: uuidv4(),
      type: `commission_${anomaly.anomalyType}`,
      severity: anomaly.severity,
      title: `Commission Anomaly: ${anomaly.accountLabel}`,
      description: anomaly.description,
      confidence: 75,
      entities: [anomaly.accountId],
      evidence: [
        `Trades: ${anomaly.metrics.tradeCount}`,
        `Avg amount: $${anomaly.metrics.avgAmount.toFixed(2)}`,
        `Total volume: $${anomaly.metrics.totalVolume.toFixed(2)}`,
        `Est. commission: $${anomaly.metrics.estimatedCommission.toFixed(2)}`,
      ],
      suggestedAction: anomaly.anomalyType === 'high_volume_low_value'
        ? 'Review for commission pumping scheme'
        : 'Monitor trading behavior',
    });
  }

  // Win/Loss analysis findings
  for (const analysis of winLossAnalyses.filter(a => a.suspicionLevel !== 'low').slice(0, 5)) {
    findings.push({
      id: uuidv4(),
      type: 'win_loss_manipulation',
      severity: analysis.suspicionLevel,
      title: `Suspicious Win/Loss Pattern: ${analysis.accountLabel}`,
      description: analysis.notes.join('. '),
      confidence: 70,
      entities: [analysis.accountId],
      evidence: [
        `Win rate: ${(analysis.winRate * 100).toFixed(1)}%`,
        `Loss rate: ${(analysis.lossRate * 100).toFixed(1)}%`,
        `Trade count: ${analysis.tradeCount}`,
        `Net profit: $${analysis.netProfit.toFixed(2)}`,
      ],
      suggestedAction: 'Check for coordinated accounts with inverse patterns',
    });
  }

  return findings.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ============ MAIN ANALYSIS ============

export async function runAgentGamma(graph: KnowledgeGraph): Promise<AgentAnalysis> {
  const startTime = new Date().toISOString();
  console.log('[Agent Gamma] Starting transaction pattern analysis...');

  // Run analyses
  const oppositePairs = detectOppositeTrading(graph);
  const commissionAnomalies = detectCommissionAnomalies(graph);
  const winLossAnalyses = analyzeWinLossRatios(graph);

  console.log(`[Agent Gamma] Found ${oppositePairs.length} opposite pairs, ${commissionAnomalies.length} commission anomalies, ${winLossAnalyses.length} suspicious patterns`);

  // Generate findings
  const findings = generateFindings(oppositePairs, commissionAnomalies, winLossAnalyses, graph);

  // Calculate financial exposure
  const totalExposure = oppositePairs.reduce((sum, p) => sum + p.tradeA.amount + p.tradeB.amount, 0);

  // Generate AI summary
  let summary = '';
  try {
    const context = JSON.stringify({
      oppositeTrades: oppositePairs.length,
      commissionAnomalies: commissionAnomalies.length,
      suspiciousPatterns: winLossAnalyses.filter(a => a.suspicionLevel !== 'low').length,
      totalExposure,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
    });
    summary = await openRouterClient.analyzeGraph(context, 'Summarize the transaction pattern analysis');
  } catch {
    summary = `Agent Gamma analyzed transaction patterns across the network. `;
    summary += `Detected ${oppositePairs.length} opposite trading pairs with $${totalExposure.toFixed(2)} exposure. `;
    summary += `Found ${commissionAnomalies.length} commission anomalies and ${winLossAnalyses.filter(a => a.suspicionLevel !== 'low').length} suspicious win/loss patterns. `;
    summary += `${findings.filter(f => f.severity === 'critical').length} critical findings require immediate attention.`;
  }

  const analysis: AgentAnalysis = {
    agentType: 'gamma',
    agentName: AGENT_NAME,
    status: 'completed',
    startedAt: startTime,
    completedAt: new Date().toISOString(),
    findings,
    summary,
    metrics: {
      oppositePairs: oppositePairs.length,
      commissionAnomalies: commissionAnomalies.length,
      suspiciousPatterns: winLossAnalyses.length,
      totalExposure,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
    },
  };

  console.log(`[Agent Gamma] Analysis complete: ${findings.length} findings, $${totalExposure.toFixed(2)} exposure`);

  return analysis;
}
