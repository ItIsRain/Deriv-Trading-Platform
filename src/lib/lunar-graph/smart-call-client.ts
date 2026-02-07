// Smart Call Client
// ElevenLabs Conversational AI integration for outbound calls with investigation context

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

interface OutboundCallRequest {
  phoneNumber: string;
  context: CopilotContext;
}

interface OutboundCallResponse {
  success: boolean;
  callId?: string;
  callSid?: string;
  message?: string;
  error?: string;
}

/**
 * Builds a conversation prompt with investigation context for the AI agent
 */
function buildAgentPrompt(context: CopilotContext): string {
  let prompt = `You are an expert fraud investigation AI assistant for the Lunar Graph platform.
You are on a phone call with an investigator discussing fraud analysis findings.
Be conversational, professional, and helpful. Answer questions about detected fraud patterns, evidence, risk scores, and investigation priorities.

INVESTIGATION DATA:

`;

  // Add graph summary
  if (context.graphSummary) {
    const g = context.graphSummary;
    prompt += `KNOWLEDGE GRAPH OVERVIEW:
- Total entities in graph: ${g.totalNodes}
- Total connections: ${g.totalEdges}
- Fraud-related connections: ${g.fraudEdges}
- Average risk score: ${g.avgRiskScore}%

`;
    if (g.highRiskEntities && g.highRiskEntities.length > 0) {
      prompt += `HIGH-RISK ENTITIES (Risk 50% or higher):
`;
      for (const entity of g.highRiskEntities.slice(0, 15)) {
        prompt += `- ${entity.label} (${entity.type}): ${entity.riskScore}% risk${entity.email ? `, email: ${entity.email}` : ''}\n`;
      }
      prompt += '\n';
    }
  }

  // Add fraud rings
  if (context.fraudRings && context.fraudRings.length > 0) {
    prompt += `DETECTED FRAUD RINGS (${context.fraudRings.length} total):
`;
    for (const ring of context.fraudRings) {
      prompt += `
${ring.name}:
- Type: ${ring.type.replace(/_/g, ' ')}
- Severity: ${ring.severity.toUpperCase()}
- Confidence: ${ring.confidence}%
- Entities involved: ${ring.entities.length}
- Financial exposure: $${ring.exposure.toFixed(2)}
- Summary: ${ring.aiSummary || 'No AI summary available'}
`;
      if (ring.evidence && ring.evidence.length > 0) {
        prompt += `- Key evidence:\n`;
        for (const e of ring.evidence.slice(0, 3)) {
          prompt += `  * ${e.description}\n`;
        }
      }
    }
    prompt += '\n';
  }

  // Add analysis summary
  if (context.analysis) {
    const a = context.analysis;
    prompt += `ANALYSIS RESULTS:
- Overall risk score: ${a.overallRiskScore} out of 100
- Summary: ${a.summary}

`;
    if (a.agents && a.agents.length > 0) {
      prompt += `AGENT FINDINGS:\n`;
      for (const agent of a.agents) {
        prompt += `- ${agent.name}: ${agent.findingsCount} findings (${agent.criticalFindings} critical, ${agent.highFindings} high priority)\n`;
      }
      prompt += '\n';
    }

    if (a.alerts && a.alerts.length > 0) {
      prompt += `ACTIVE ALERTS:\n`;
      for (const alert of a.alerts.slice(0, 8)) {
        prompt += `- [${alert.severity.toUpperCase()}] ${alert.title}\n`;
      }
      prompt += '\n';
    }
  }

  // Add selected entities context
  if (context.selectedEntities && context.selectedEntities.length > 0) {
    prompt += `CURRENTLY FOCUSED ENTITIES:
The investigator has selected these specific entities: ${context.selectedEntities.join(', ')}

`;
  }

  prompt += `GUIDELINES FOR THE CALL:
1. Start by greeting the investigator and briefly summarizing the key findings
2. Answer questions about fraud patterns, connections, and evidence clearly
3. Provide specific data points when asked (risk scores, entity names, exposure amounts)
4. Recommend investigation priorities based on severity
5. Be concise but thorough - this is a professional investigation call
6. If asked about something not in the data, acknowledge the limitation
7. Speak naturally - use conversational phrases like "based on what I'm seeing" or "the data shows"
`;

  return prompt;
}

/**
 * SmartCallClient - Handles ElevenLabs Conversational AI outbound calls
 */
export class SmartCallClient {
  private apiKey: string;
  private agentId: string;
  private phoneNumberId: string;
  private baseUrl = 'https://api.elevenlabs.io';

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is not set');
    }
    if (!agentId) {
      throw new Error('ELEVENLABS_AGENT_ID environment variable is not set');
    }
    if (!phoneNumberId) {
      throw new Error('ELEVENLABS_PHONE_NUMBER_ID environment variable is not set');
    }

    this.apiKey = apiKey;
    this.agentId = agentId;
    this.phoneNumberId = phoneNumberId;
  }

  /**
   * Initiates an outbound call using ElevenLabs Conversational AI
   * API: POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
   */
  async initiateCall(request: OutboundCallRequest): Promise<OutboundCallResponse> {
    const { phoneNumber, context } = request;

    // Build the dynamic prompt with investigation context
    const prompt = buildAgentPrompt(context);

    const requestBody = {
      agent_id: this.agentId,
      agent_phone_number_id: this.phoneNumberId,
      to_number: phoneNumber,
      // Override the agent's system prompt with investigation context
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: prompt,
          },
          first_message: "Hello! This is the Lunar Graph Investigation Assistant. I have the fraud analysis data ready. How can I help you understand the findings?",
        },
      },
    };

    console.log('[SmartCallClient] Request:', {
      url: `${this.baseUrl}/v1/convai/twilio/outbound-call`,
      agent_id: this.agentId,
      agent_phone_number_id: this.phoneNumberId,
      to_number: phoneNumber,
    });

    try {
      const response = await fetch(`${this.baseUrl}/v1/convai/twilio/outbound-call`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `ElevenLabs API error: ${response.status}`;

        try {
          const errorData = JSON.parse(errorText);
          console.error('[SmartCallClient] ElevenLabs API error:', response.status, errorData);

          // Extract error message from various possible formats
          if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string'
              ? errorData.detail
              : errorData.detail.message || JSON.stringify(errorData.detail);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = typeof errorData.error === 'string'
              ? errorData.error
              : errorData.error.message || JSON.stringify(errorData.error);
          }
        } catch {
          console.error('[SmartCallClient] ElevenLabs API error:', response.status, errorText);
          if (errorText) {
            errorMessage = errorText.slice(0, 200);
          }
        }

        return {
          success: false,
          error: errorMessage,
        };
      }

      // Response format: { success: true, message: "...", conversation_id: "...", callSid: "..." }
      const data = await response.json();

      return {
        success: data.success === true,
        callId: data.conversation_id,
        callSid: data.callSid,
        message: data.message,
      };
    } catch (error) {
      console.error('[SmartCallClient] Error initiating call:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate call',
      };
    }
  }

  /**
   * Gets the status of an ongoing or completed call
   */
  async getCallStatus(conversationId: string): Promise<{ status: string; duration?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/convai/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        return {
          status: 'unknown',
          error: `Failed to get status: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        status: data.status || 'unknown',
        duration: data.metadata?.call_duration_secs,
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to get call status',
      };
    }
  }
}

// Export a factory function to create the client
export function createSmartCallClient(): SmartCallClient {
  return new SmartCallClient();
}
