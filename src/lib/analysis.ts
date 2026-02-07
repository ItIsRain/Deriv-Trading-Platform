// Fraud detection analysis engine

import { Trade, CorrelationResult, GraphNode, GraphEdge } from '@/types';
import { getTrades, getAllAccounts, getAffiliates, getClients, getPartner } from './store';

// Analyze timing correlation between two accounts
function analyzeTimingCorrelation(tradesA: Trade[], tradesB: Trade[]): { score: number; matches: Array<{ tradeA: Trade; tradeB: Trade; timeDelta: number }> } {
  const matches: Array<{ tradeA: Trade; tradeB: Trade; timeDelta: number }> = [];
  const windowMs = 60000; // 60 second window

  for (const tradeA of tradesA) {
    for (const tradeB of tradesB) {
      const timeDelta = Math.abs(
        new Date(tradeA.timestamp).getTime() - new Date(tradeB.timestamp).getTime()
      );

      if (timeDelta <= windowMs) {
        matches.push({ tradeA, tradeB, timeDelta });
      }
    }
  }

  const totalPossibleMatches = Math.min(tradesA.length, tradesB.length);
  const score = totalPossibleMatches > 0
    ? Math.min(100, (matches.length / totalPossibleMatches) * 100)
    : 0;

  return { score, matches };
}

// Analyze direction correlation (opposite trading)
function analyzeDirectionCorrelation(matches: Array<{ tradeA: Trade; tradeB: Trade; timeDelta: number }>): number {
  if (matches.length === 0) return 0;

  let oppositeCount = 0;
  for (const { tradeA, tradeB } of matches) {
    if (
      (tradeA.contractType === 'CALL' && tradeB.contractType === 'PUT') ||
      (tradeA.contractType === 'PUT' && tradeB.contractType === 'CALL')
    ) {
      oppositeCount++;
    }
  }

  return (oppositeCount / matches.length) * 100;
}

// Analyze amount correlation (similar trade sizes)
function analyzeAmountCorrelation(matches: Array<{ tradeA: Trade; tradeB: Trade; timeDelta: number }>): number {
  if (matches.length === 0) return 0;

  let similarCount = 0;
  const threshold = 0.2; // 20% difference tolerance

  for (const { tradeA, tradeB } of matches) {
    const diff = Math.abs(tradeA.amount - tradeB.amount);
    const avg = (tradeA.amount + tradeB.amount) / 2;

    if (diff / avg <= threshold) {
      similarCount++;
    }
  }

  return (similarCount / matches.length) * 100;
}

// Analyze symbol correlation (same instruments)
function analyzeSymbolCorrelation(matches: Array<{ tradeA: Trade; tradeB: Trade; timeDelta: number }>): number {
  if (matches.length === 0) return 0;

  let sameSymbolCount = 0;
  for (const { tradeA, tradeB } of matches) {
    if (tradeA.symbol === tradeB.symbol) {
      sameSymbolCount++;
    }
  }

  return (sameSymbolCount / matches.length) * 100;
}

// Run full correlation analysis between all account pairs
export function runCorrelationAnalysis(): CorrelationResult[] {
  const accounts = getAllAccounts();
  const trades = getTrades();
  const results: CorrelationResult[] = [];

  // Get trades grouped by account
  const tradesByAccount: Map<string, Trade[]> = new Map();
  for (const account of accounts) {
    tradesByAccount.set(
      account.id,
      trades.filter(t => t.accountId === account.id)
    );
  }

  // Compare each pair of accounts
  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      const accountA = accounts[i];
      const accountB = accounts[j];

      const tradesA = tradesByAccount.get(accountA.id) || [];
      const tradesB = tradesByAccount.get(accountB.id) || [];

      // Skip if either account has no trades
      if (tradesA.length === 0 || tradesB.length === 0) continue;

      // Run timing analysis
      const { score: timingScore, matches } = analyzeTimingCorrelation(tradesA, tradesB);

      // Skip if no timing correlation
      if (matches.length === 0) continue;

      // Run other analyses
      const directionScore = analyzeDirectionCorrelation(matches);
      const amountScore = analyzeAmountCorrelation(matches);
      const symbolScore = analyzeSymbolCorrelation(matches);

      // Calculate overall score (weighted average)
      const overallScore = (
        timingScore * 0.25 +
        directionScore * 0.35 +  // Direction is most important for opposite trading fraud
        amountScore * 0.2 +
        symbolScore * 0.2
      );

      // Determine status
      let status: 'FLAGGED' | 'SUSPICIOUS' | 'NORMAL';
      if (overallScore >= 70) {
        status = 'FLAGGED';
      } else if (overallScore >= 50) {
        status = 'SUSPICIOUS';
      } else {
        status = 'NORMAL';
      }

      results.push({
        accountA: accountA.id,
        accountB: accountB.id,
        accountAType: accountA.type,
        accountBType: accountB.type,
        timingScore,
        directionScore,
        amountScore,
        overallScore,
        status,
        matchedTrades: matches,
      });
    }
  }

  // Sort by overall score descending
  results.sort((a, b) => b.overallScore - a.overallScore);

  return results;
}

// Build graph data from accounts and correlations
export function buildGraphData(correlations: CorrelationResult[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const flaggedAccounts = new Set<string>();

  // Get flagged accounts from correlations
  for (const corr of correlations) {
    if (corr.status === 'FLAGGED' || corr.status === 'SUSPICIOUS') {
      flaggedAccounts.add(corr.accountA);
      flaggedAccounts.add(corr.accountB);
    }
  }

  // Build nodes
  const partner = getPartner();
  const affiliates = getAffiliates();
  const clients = getClients();

  // Position helpers
  const centerX = 400;
  const centerY = 300;

  if (partner) {
    nodes.push({
      id: partner.id,
      type: 'partner',
      name: partner.name,
      x: centerX,
      y: centerY - 150,
      vx: 0,
      vy: 0,
      fraud: flaggedAccounts.has(partner.id),
      correlationScore: getMaxCorrelationScore(partner.id, correlations),
    });
  }

  affiliates.forEach((aff, i) => {
    const angle = (i / affiliates.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 150;

    nodes.push({
      id: aff.id,
      type: 'affiliate',
      name: aff.name,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      fraud: flaggedAccounts.has(aff.id),
      correlationScore: getMaxCorrelationScore(aff.id, correlations),
    });

    // Edge from partner to affiliate
    if (partner) {
      edges.push({
        source: partner.id,
        target: aff.id,
        fraud: flaggedAccounts.has(partner.id) || flaggedAccounts.has(aff.id),
      });
    }
  });

  clients.forEach((client, i) => {
    const affiliate = affiliates.find(a => a.id === client.affiliateId);
    if (!affiliate) return;

    const affNode = nodes.find(n => n.id === affiliate.id);
    if (!affNode) return;

    const clientsOfAffiliate = clients.filter(c => c.affiliateId === affiliate.id);
    const clientIdx = clientsOfAffiliate.indexOf(client);
    const angle = (clientIdx / clientsOfAffiliate.length) * Math.PI - Math.PI / 2;
    const radius = 80;

    nodes.push({
      id: client.id,
      type: 'client',
      name: `Client ${client.id.slice(0, 6)}`,
      x: affNode.x + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
      y: affNode.y + Math.sin(angle) * radius + 100 + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      fraud: flaggedAccounts.has(client.id),
      correlationScore: getMaxCorrelationScore(client.id, correlations),
    });

    // Edge from affiliate to client
    edges.push({
      source: affiliate.id,
      target: client.id,
      fraud: flaggedAccounts.has(affiliate.id) || flaggedAccounts.has(client.id),
    });
  });

  // Add correlation edges (for flagged pairs)
  for (const corr of correlations) {
    if (corr.status === 'FLAGGED') {
      // Check if edge doesn't already exist
      const exists = edges.some(
        e => (e.source === corr.accountA && e.target === corr.accountB) ||
             (e.source === corr.accountB && e.target === corr.accountA)
      );

      if (!exists) {
        edges.push({
          source: corr.accountA,
          target: corr.accountB,
          fraud: true,
        });
      }
    }
  }

  return { nodes, edges };
}

function getMaxCorrelationScore(accountId: string, correlations: CorrelationResult[]): number {
  let maxScore = 0;
  for (const corr of correlations) {
    if (corr.accountA === accountId || corr.accountB === accountId) {
      maxScore = Math.max(maxScore, corr.overallScore);
    }
  }
  return maxScore;
}

// Generate AI analysis summary
export function generateAnalysisSummary(correlations: CorrelationResult[]): string {
  const flagged = correlations.filter(c => c.status === 'FLAGGED');
  const suspicious = correlations.filter(c => c.status === 'SUSPICIOUS');

  if (flagged.length === 0 && suspicious.length === 0) {
    return 'No suspicious patterns detected. All trading activity appears normal.';
  }

  let summary = `Analysis complete. Found ${flagged.length} high-risk and ${suspicious.length} suspicious account pairs.\n\n`;

  if (flagged.length > 0) {
    summary += '**Critical Findings:**\n';
    flagged.forEach((corr, i) => {
      summary += `${i + 1}. Accounts show ${Math.round(corr.overallScore)}% correlation with `;
      if (corr.directionScore > 80) {
        summary += 'opposite trading patterns (potential wash trading). ';
      }
      if (corr.timingScore > 80) {
        summary += 'Trades executed within seconds of each other. ';
      }
      summary += '\n';
    });
  }

  return summary;
}
