'use client';

import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { CopilotMessage, KnowledgeGraph, CombinedAnalysis, FraudRing } from '@/types/lunar-graph';
import { v4 as uuidv4 } from 'uuid';

interface InvestigationCopilotProps {
  selectedEntities?: string[];
  fraudRingId?: string;
  graph?: KnowledgeGraph | null;
  analysis?: CombinedAnalysis | null;
  fraudRings?: FraudRing[];
  height?: number;
}

// Helper to render inline bold text like "**Type**: value"
function renderInlineBold(text: string): React.ReactNode {
  // Split on bold markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  if (parts.length === 1) return text;

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="text-white font-medium">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

const INITIAL_MESSAGE: CopilotMessage = {
  id: 'initial',
  role: 'assistant',
  content: `Hello! I'm the Lunar Graph Investigation Copilot. I have access to your full fraud analysis data.

**I can help you:**
- Explain detected fraud rings and their evidence
- Analyze entity connections and risk patterns
- Review alerts and recommend actions
- Answer questions about specific accounts

**Try asking:**
- "What fraud rings were detected?"
- "Explain the opposite trading pattern"
- "Who are the high-risk entities?"
- "What should I investigate first?"

How can I assist your investigation?`,
  timestamp: new Date().toISOString(),
};

export default function InvestigationCopilot({
  selectedEntities = [],
  fraudRingId,
  graph,
  analysis,
  fraudRings = [],
  height = 400,
}: InvestigationCopilotProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCount = useRef(1); // Start at 1 for initial message

  // Scroll to bottom only when new messages are added (not on mount/tab switch)
  useEffect(() => {
    if (messages.length > prevMessageCount.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build comprehensive context for the AI
  const buildContext = useCallback(() => {
    const context: any = {
      selectedEntities,
      fraudRingId,
    };

    // Add graph summary
    if (graph) {
      context.graphSummary = {
        totalNodes: graph.stats.totalNodes,
        totalEdges: graph.stats.totalEdges,
        fraudEdges: graph.stats.fraudEdges,
        avgRiskScore: graph.stats.avgRiskScore,
        highRiskEntities: graph.nodes
          .filter(n => n.riskScore >= 50)
          .map(n => ({
            id: n.id,
            label: n.label,
            type: n.type,
            riskScore: n.riskScore,
            email: n.metadata.email,
          })),
      };
    }

    // Add fraud rings with full details
    if (fraudRings.length > 0) {
      context.fraudRings = fraudRings.map(ring => ({
        id: ring.id,
        name: ring.name,
        type: ring.type,
        severity: ring.severity,
        confidence: ring.confidence,
        entities: ring.entities,
        exposure: ring.exposure,
        evidence: ring.evidence,
        aiSummary: ring.aiSummary,
      }));
    }

    // Add analysis findings
    if (analysis) {
      context.analysis = {
        overallRiskScore: analysis.overallRiskScore,
        summary: analysis.summary,
        agents: analysis.agents?.map(a => ({
          name: a.agentName,
          type: a.agentType,
          findingsCount: a.findings.length,
          criticalFindings: a.findings.filter(f => f.severity === 'critical').length,
          highFindings: a.findings.filter(f => f.severity === 'high').length,
          summary: a.summary,
        })),
        alerts: analysis.alerts?.slice(0, 10).map(a => ({
          severity: a.severity,
          title: a.title,
          description: a.description,
          entities: a.entities,
        })),
      };
    }

    return context;
  }, [selectedEntities, fraudRingId, graph, fraudRings, analysis]);

  // Send message to copilot API
  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: CopilotMessage = {
      id: uuidv4(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = buildContext();

      const response = await fetch('/api/lunar-graph/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedInput,
          context,
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: 'assistant',
            content: data.error || 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: 'assistant',
          content: 'Connection error. Please check your network and try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, buildContext]);

  // Handle Enter key
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: 'Fraud Rings', query: 'What fraud rings were detected? Explain each one.' },
    { label: 'High Risk', query: 'List all high-risk entities with their details.' },
    { label: 'Next Steps', query: 'What should I investigate first? Prioritize the issues.' },
  ];

  return (
    <div className="flex flex-col bg-[#0a0a0f] rounded-lg border border-[rgba(255,68,79,0.2)]" style={{ height }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[rgba(255,68,79,0.2)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-white">Investigation Copilot</span>
          {analysis && (
            <span className="ml-auto text-xs text-gray-500">
              Risk: {analysis.overallRiskScore}/100
            </span>
          )}
        </div>
        {(selectedEntities.length > 0 || fraudRings.length > 0) && (
          <div className="mt-1 text-xs text-gray-400">
            {selectedEntities.length > 0 && `${selectedEntities.length} entities selected`}
            {selectedEntities.length > 0 && fraudRings.length > 0 && ' | '}
            {fraudRings.length > 0 && `${fraudRings.length} fraud rings detected`}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-[#FF444F] text-white'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-200'
              }`}
            >
              <div className="text-sm">
                {message.content.split('\n').map((line, i) => {
                  const trimmed = line.trim();

                  // H1 headers
                  if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                    return (
                      <div key={i} className="font-bold text-white mt-4 mb-2 first:mt-0 text-lg">
                        {trimmed.slice(2)}
                      </div>
                    );
                  }

                  // H3 headers
                  if (trimmed.startsWith('### ')) {
                    return (
                      <div key={i} className="font-semibold text-white mt-3 mb-1 first:mt-0 text-base">
                        {trimmed.slice(4)}
                      </div>
                    );
                  }

                  // H2 headers
                  if (trimmed.startsWith('## ')) {
                    return (
                      <div key={i} className="font-bold text-white mt-3 mb-1 first:mt-0 text-base">
                        {trimmed.slice(3)}
                      </div>
                    );
                  }

                  // Standalone bold text (entire line)
                  if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
                    return (
                      <div key={i} className="font-semibold text-white mt-2 first:mt-0">
                        {trimmed.slice(2, -2)}
                      </div>
                    );
                  }

                  // Numbered list
                  if (/^\d+\.\s/.test(trimmed)) {
                    return (
                      <div key={i} className="ml-3 text-gray-300 my-0.5">
                        {renderInlineBold(trimmed)}
                      </div>
                    );
                  }

                  // Bullet list (- or •)
                  if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                    return (
                      <div key={i} className="ml-3 text-gray-300 my-0.5">
                        • {renderInlineBold(trimmed.slice(2))}
                      </div>
                    );
                  }

                  // Empty line
                  if (trimmed === '') {
                    return <div key={i} className="h-2" />;
                  }

                  // Regular text with inline bold support
                  return <div key={i} className="my-0.5">{renderInlineBold(trimmed)}</div>;
                })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[rgba(255,255,255,0.05)] rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 flex-wrap">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setInput(action.query);
                  setTimeout(() => sendMessage(), 100);
                }}
                className="px-3 py-1.5 text-xs bg-[rgba(255,68,79,0.1)] hover:bg-[rgba(255,68,79,0.2)] text-red-400 rounded-full transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-[rgba(255,68,79,0.2)]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about fraud patterns, entities, or recommendations..."
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,68,79,0.2)] rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#FF444F] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-[#FF444F] hover:bg-[#FF5A63] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
