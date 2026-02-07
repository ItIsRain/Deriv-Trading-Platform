// API Route: Investigation Copilot
// Natural language interface for fraud investigation with full context

import { NextRequest, NextResponse } from 'next/server';
import { openRouterClient } from '@/lib/lunar-graph/openrouter-client';
import { CopilotResponse, CopilotMessage } from '@/types/lunar-graph';
import { v4 as uuidv4 } from 'uuid';

interface CopilotContext {
  selectedEntities?: string[];
  fraudRingId?: string;
  graphSummary?: {
    totalNodes: number;
    totalEdges: number;
    fraudEdges: number;
    avgRiskScore: number;
    highRiskEntities: Array<{
      id: string;
      label: string;
      type: string;
      riskScore: number;
      email?: string;
    }>;
  };
  fraudRings?: Array<{
    id: string;
    name: string;
    type: string;
    severity: string;
    confidence: number;
    entities: string[];
    exposure: number;
    evidence: any[];
    aiSummary: string;
  }>;
  analysis?: {
    overallRiskScore: number;
    summary: string;
    agents?: Array<{
      name: string;
      type: string;
      findingsCount: number;
      criticalFindings: number;
      highFindings: number;
      summary: string;
    }>;
    alerts?: Array<{
      severity: string;
      title: string;
      description: string;
      entities: string[];
    }>;
  };
}

interface CopilotRequest {
  message: string;
  context?: CopilotContext;
}

function buildSystemPrompt(context: CopilotContext): string {
  let prompt = `You are an expert fraud investigation analyst for the Lunar Graph platform. You help investigators understand and act on detected fraud patterns.

You have access to the following data:

`;

  // Add graph summary
  if (context.graphSummary) {
    const g = context.graphSummary;
    prompt += `## KNOWLEDGE GRAPH
- Total entities: ${g.totalNodes}
- Total connections: ${g.totalEdges}
- Fraud-related connections: ${g.fraudEdges}
- Average risk score: ${g.avgRiskScore}%

`;
    if (g.highRiskEntities && g.highRiskEntities.length > 0) {
      prompt += `## HIGH-RISK ENTITIES (Risk >= 50%)
`;
      for (const entity of g.highRiskEntities.slice(0, 20)) {
        prompt += `- ${entity.label} (${entity.type}): Risk ${entity.riskScore}%${entity.email ? `, Email: ${entity.email}` : ''}\n`;
      }
      prompt += '\n';
    }
  }

  // Add fraud rings
  if (context.fraudRings && context.fraudRings.length > 0) {
    prompt += `## DETECTED FRAUD RINGS
`;
    for (const ring of context.fraudRings) {
      prompt += `### ${ring.name}
- Type: ${ring.type}
- Severity: ${ring.severity.toUpperCase()}
- Confidence: ${ring.confidence}%
- Entities involved: ${ring.entities.length}
- Financial exposure: $${ring.exposure.toFixed(2)}
- Summary: ${ring.aiSummary || 'No summary available'}
`;
      if (ring.evidence && ring.evidence.length > 0) {
        prompt += `- Evidence:\n`;
        for (const e of ring.evidence.slice(0, 5)) {
          prompt += `  * ${e.description} (${e.confidence}% confidence)\n`;
        }
      }
      prompt += '\n';
    }
  }

  // Add analysis summary
  if (context.analysis) {
    const a = context.analysis;
    prompt += `## ANALYSIS RESULTS
- Overall risk score: ${a.overallRiskScore}/100
- Summary: ${a.summary}

`;
    if (a.agents && a.agents.length > 0) {
      prompt += `### Agent Analysis
`;
      for (const agent of a.agents) {
        prompt += `- ${agent.name}: ${agent.findingsCount} findings (${agent.criticalFindings} critical, ${agent.highFindings} high)\n`;
      }
      prompt += '\n';
    }

    if (a.alerts && a.alerts.length > 0) {
      prompt += `### Active Alerts
`;
      for (const alert of a.alerts.slice(0, 10)) {
        prompt += `- [${alert.severity.toUpperCase()}] ${alert.title}\n`;
        if (alert.description) {
          prompt += `  ${alert.description}\n`;
        }
      }
      prompt += '\n';
    }
  }

  // Add selected entities context
  if (context.selectedEntities && context.selectedEntities.length > 0) {
    prompt += `## CURRENTLY SELECTED
The investigator is focused on these entities: ${context.selectedEntities.join(', ')}

`;
  }

  prompt += `## YOUR ROLE
1. Answer questions about the fraud patterns and entities
2. Explain the evidence and connections
3. Recommend investigation steps
4. Help prioritize issues by severity
5. Provide actionable insights

Be concise but thorough. Use the data above to give specific, accurate answers.`;

  return prompt;
}

async function processQuery(
  message: string,
  context: CopilotContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);

  try {
    const response = await openRouterClient.chatWithSystem(systemPrompt, message);
    return response;
  } catch (error) {
    console.error('[Copilot] AI response error:', error);
    return generateFallbackResponse(message, context);
  }
}

function generateFallbackResponse(message: string, context: CopilotContext): string {
  const lowerMessage = message.toLowerCase();

  // Check for fraud rings question
  if (lowerMessage.includes('fraud') || lowerMessage.includes('ring')) {
    if (context.fraudRings && context.fraudRings.length > 0) {
      let response = `**Detected Fraud Rings (${context.fraudRings.length})**\n\n`;
      for (const ring of context.fraudRings) {
        response += `**${ring.name}**\n`;
        response += `- Type: ${ring.type.replace(/_/g, ' ')}\n`;
        response += `- Severity: ${ring.severity.toUpperCase()}\n`;
        response += `- Entities: ${ring.entities.length}\n`;
        response += `- Exposure: $${ring.exposure.toFixed(2)}\n`;
        response += `- ${ring.aiSummary}\n\n`;
      }
      return response;
    }
    return 'No fraud rings have been detected yet. Run an analysis to detect patterns.';
  }

  // Check for high risk question
  if (lowerMessage.includes('risk') || lowerMessage.includes('high')) {
    if (context.graphSummary?.highRiskEntities && context.graphSummary.highRiskEntities.length > 0) {
      let response = `**High-Risk Entities (${context.graphSummary.highRiskEntities.length})**\n\n`;
      for (const entity of context.graphSummary.highRiskEntities.slice(0, 10)) {
        response += `- **${entity.label}** (${entity.type}): ${entity.riskScore}% risk`;
        if (entity.email) response += ` - ${entity.email}`;
        response += '\n';
      }
      return response;
    }
    return 'No high-risk entities detected. The average risk score is low.';
  }

  // Check for alerts question
  if (lowerMessage.includes('alert') || lowerMessage.includes('warning')) {
    if (context.analysis?.alerts && context.analysis.alerts.length > 0) {
      let response = `**Active Alerts (${context.analysis.alerts.length})**\n\n`;
      for (const alert of context.analysis.alerts.slice(0, 10)) {
        response += `- **[${alert.severity.toUpperCase()}]** ${alert.title}\n`;
        if (alert.description) response += `  ${alert.description}\n`;
      }
      return response;
    }
    return 'No active alerts at the moment.';
  }

  // Check for investigation/priority question
  if (lowerMessage.includes('investigate') || lowerMessage.includes('priority') || lowerMessage.includes('first')) {
    let response = '**Investigation Priority**\n\n';

    if (context.fraudRings && context.fraudRings.length > 0) {
      const critical = context.fraudRings.filter(r => r.severity === 'critical');
      const high = context.fraudRings.filter(r => r.severity === 'high');

      if (critical.length > 0) {
        response += '**1. Critical Fraud Rings (Immediate Action Required)**\n';
        for (const ring of critical) {
          response += `   - ${ring.name}: ${ring.entities.length} entities, $${ring.exposure.toFixed(2)} exposure\n`;
        }
        response += '\n';
      }

      if (high.length > 0) {
        response += '**2. High Severity Issues**\n';
        for (const ring of high) {
          response += `   - ${ring.name}: ${ring.entities.length} entities, $${ring.exposure.toFixed(2)} exposure\n`;
        }
        response += '\n';
      }
    }

    response += '**Recommended Steps:**\n';
    response += '1. Review entities in critical fraud rings\n';
    response += '2. Check account history and trading patterns\n';
    response += '3. Cross-reference with IP and device data\n';
    response += '4. Document findings for compliance\n';

    return response;
  }

  // Default response
  return `I have access to your fraud analysis data. You can ask me:

- "What fraud rings were detected?"
- "Show high-risk entities"
- "What alerts need attention?"
- "What should I investigate first?"
- "Explain the opposite trading pattern"

How can I help with your investigation?`;
}

export async function POST(request: NextRequest): Promise<NextResponse<CopilotResponse>> {
  try {
    const body: CopilotRequest = await request.json();
    const { message, context = {} } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log('[Copilot] Processing:', message.slice(0, 50));
    console.log('[Copilot] Context:', {
      hasGraph: !!context.graphSummary,
      fraudRings: context.fraudRings?.length || 0,
      hasAnalysis: !!context.analysis,
    });

    const response = await processQuery(message, context);

    const copilotMessage: CopilotMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: copilotMessage,
    });
  } catch (error) {
    console.error('[Copilot] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process query',
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: 'Copilot API is running' });
}
