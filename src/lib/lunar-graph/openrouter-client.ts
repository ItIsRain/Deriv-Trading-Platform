// OpenRouter Client for Claude API calls
// Used by all fraud detection agents for AI-powered analysis

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    this.baseUrl = OPENROUTER_API_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  async chat(
    messages: OpenRouterMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    if (!this.isConfigured()) {
      console.warn('[OpenRouter] API key not configured, using mock response');
      return this.getMockResponse(messages);
    }

    const allMessages: OpenRouterMessage[] = [];

    // Add system prompt if provided
    if (options?.systemPrompt) {
      allMessages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    // Add conversation messages
    allMessages.push(...messages);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Lunar Graph Fraud Detection',
        },
        body: JSON.stringify({
          model: this.model,
          messages: allMessages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1024,
        }),
      });

      if (!response.ok) {
        const error: OpenRouterError = await response.json();
        console.error('[OpenRouter] API error:', error);
        throw new Error(error.error?.message || 'OpenRouter API request failed');
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('[OpenRouter] Request failed:', error);
      // Fallback to mock response on error
      return this.getMockResponse(messages);
    }
  }

  async analyzeGraph(graphContext: string, query: string): Promise<string> {
    const systemPrompt = `You are an expert fraud analyst AI assistant for the Lunar Graph fraud detection system.
You analyze financial transaction patterns, affiliate networks, and trading behavior to detect fraud.

When analyzing data:
1. Look for coordinated trading patterns (opposite positions, timing sync)
2. Identify suspicious network structures (hub accounts, tight clusters)
3. Detect anomalies in transaction volumes and frequencies
4. Consider multi-account abuse indicators (shared IPs, device fingerprints)

Provide clear, actionable insights with confidence levels.
Format findings with severity levels: low, medium, high, critical.`;

    return this.chat(
      [
        { role: 'user', content: `Graph Context:\n${graphContext}\n\nAnalysis Request:\n${query}` }
      ],
      { systemPrompt, temperature: 0.3 }
    );
  }

  async explainFraudRing(ringData: string): Promise<string> {
    const systemPrompt = `You are a fraud investigation AI that explains complex fraud patterns in clear terms.
Given fraud ring data, provide:
1. A plain-language explanation of the fraud scheme
2. The key evidence points
3. Estimated financial exposure
4. Recommended actions`;

    return this.chat(
      [{ role: 'user', content: `Explain this fraud ring:\n${ringData}` }],
      { systemPrompt, temperature: 0.5 }
    );
  }

  async generateInvestigationQuery(context: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are an investigation copilot for fraud analysts.
Help users investigate fraud by:
1. Answering questions about detected patterns
2. Suggesting investigation paths
3. Explaining evidence chains
4. Providing confidence assessments

Current investigation context is provided. Respond concisely and professionally.`;

    return this.chat(
      [{ role: 'user', content: `Context:\n${context}\n\nUser Question:\n${userQuery}` }],
      { systemPrompt, temperature: 0.6, maxTokens: 512 }
    );
  }

  // Simple chat with system prompt and user message
  async chatWithSystem(systemPrompt: string, userMessage: string): Promise<string> {
    return this.chat(
      [{ role: 'user', content: userMessage }],
      { systemPrompt, temperature: 0.6, maxTokens: 1500 }
    );
  }

  private getMockResponse(messages: OpenRouterMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

    if (lastMessage.includes('fraud') || lastMessage.includes('ring')) {
      return `**Fraud Analysis Summary**

Based on the graph analysis, I've identified the following patterns:

1. **Opposite Trading Ring** (High Confidence: 87%)
   - 3 accounts showing coordinated CALL/PUT positions
   - Average time delta: 2.3 seconds
   - Estimated exposure: $4,500

2. **IP Clustering** (Medium Confidence: 65%)
   - 5 accounts sharing similar IP ranges
   - Possible VPN usage detected
   - Recommended: Manual verification

**Suggested Actions:**
- Flag accounts for review
- Monitor future trading patterns
- Consider temporary trading limits`;
    }

    if (lastMessage.includes('explain') || lastMessage.includes('what')) {
      return `This pattern indicates coordinated fraudulent activity where multiple accounts are used to guarantee profits through opposite positions.

**How it works:**
1. Account A places a CALL option
2. Account B places a PUT option on the same asset
3. One position always wins, profits are extracted

**Evidence:**
- Matching trade amounts
- Sub-5 second execution timing
- Same device fingerprint across accounts

**Risk Level:** High - Immediate investigation recommended`;
    }

    if (lastMessage.includes('investigate') || lastMessage.includes('check')) {
      return `I recommend the following investigation steps:

1. **Review Account History**
   - Check all trades for the flagged accounts
   - Look for patterns in trade timing and amounts

2. **Network Analysis**
   - Map all connections to these accounts
   - Check for shared IPs, devices, or referral chains

3. **Financial Impact**
   - Calculate total suspicious volume
   - Estimate commission leakage

Would you like me to generate a detailed report for any of these areas?`;
    }

    return `I've analyzed the available data. Here are my findings:

- Graph contains multiple interconnected clusters
- Several potential fraud indicators detected
- Risk scores range from low to high across entities

For more specific analysis, try asking about:
- Specific fraud rings or patterns
- Investigation suggestions
- Evidence explanations`;
  }
}

// Singleton instance
export const openRouterClient = new OpenRouterClient();
