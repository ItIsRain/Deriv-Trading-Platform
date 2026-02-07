'use client';

import { AgentAnalysis } from '@/types/lunar-graph';

interface AgentStatusPanelProps {
  agents: AgentAnalysis[];
  isRunning?: boolean;
  onAgentClick?: (agent: AgentAnalysis) => void;
}

// SVG Icon components for agents
const AlphaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
);

const BetaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const GammaIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const AGENT_INFO = {
  alpha: {
    name: 'Agent Alpha',
    description: 'Graph Anomaly Detection',
    icon: AlphaIcon,
    color: 'blue',
  },
  beta: {
    name: 'Agent Beta',
    description: 'Temporal Intelligence',
    icon: BetaIcon,
    color: 'orange',
  },
  gamma: {
    name: 'Agent Gamma',
    description: 'Transaction Patterns',
    icon: GammaIcon,
    color: 'red',
  },
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-yellow-400';
    case 'completed':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

function formatDuration(start: string, end?: string): string {
  if (!end) return 'Running...';
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
}

export default function AgentStatusPanel({ agents, isRunning = false, onAgentClick }: AgentStatusPanelProps) {
  if (agents.length === 0 && !isRunning) {
    return (
      <div className="space-y-3">
        {Object.entries(AGENT_INFO).map(([type, info]) => (
          <AgentCard key={type} info={info} status="idle" />
        ))}
      </div>
    );
  }

  if (isRunning && agents.length === 0) {
    return (
      <div className="space-y-3">
        {Object.entries(AGENT_INFO).map(([type, info]) => (
          <AgentCard key={type} info={info} status="running" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const info = AGENT_INFO[agent.agentType as keyof typeof AGENT_INFO];
        return (
          <AgentCard
            key={agent.agentType}
            info={info}
            analysis={agent}
            status={agent.status}
            onClick={onAgentClick ? () => onAgentClick(agent) : undefined}
          />
        );
      })}
    </div>
  );
}

interface AgentInfoType {
  name: string;
  description: string;
  icon: () => JSX.Element;
  color: string;
}

function AgentCard({
  info,
  analysis,
  status = 'idle',
  onClick,
}: {
  info: AgentInfoType;
  analysis?: AgentAnalysis;
  status: 'idle' | 'running' | 'completed' | 'error';
  onClick?: () => void;
}) {
  return (
    <div
      className={`
        p-3 rounded-lg border transition-all
        ${status === 'running' ? 'bg-yellow-500/10 border-yellow-500/30 animate-pulse' :
          status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
          status === 'error' ? 'bg-red-500/10 border-red-500/30' :
          'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)]'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <info.icon />
          <div>
            <h4 className="text-sm font-medium text-white">{info.name}</h4>
            <p className="text-xs text-gray-500">{info.description}</p>
          </div>
        </div>
        <div className={`text-xs font-medium ${getStatusColor(status)}`}>
          {status === 'running' && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-spin" />
              Running
            </span>
          )}
          {status === 'completed' && '✓ Complete'}
          {status === 'error' && '✗ Error'}
          {status === 'idle' && 'Idle'}
        </div>
      </div>

      {/* Metrics */}
      {analysis && status === 'completed' && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-white font-medium text-sm">
                {analysis.findings.length}
              </div>
              <div className="text-xs text-gray-500">Findings</div>
            </div>
            <div>
              <div className="text-red-400 font-medium text-sm">
                {analysis.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length}
              </div>
              <div className="text-xs text-gray-500">Critical</div>
            </div>
            <div>
              <div className="text-gray-300 font-medium text-sm">
                {formatDuration(analysis.startedAt, analysis.completedAt)}
              </div>
              <div className="text-xs text-gray-500">Duration</div>
            </div>
          </div>

          {/* Key metrics from agent */}
          {analysis.metrics && Object.keys(analysis.metrics).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(analysis.metrics).slice(0, 4).map(([key, value]) => (
                <div
                  key={key}
                  className="px-2 py-1 bg-[rgba(255,255,255,0.05)] rounded text-xs"
                >
                  <span className="text-gray-400">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>{' '}
                  <span className="text-white font-medium">
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* View Details button */}
          {onClick && (
            <button
              onClick={onClick}
              className="mt-3 w-full py-1.5 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
            >
              View Details
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar
export function AgentStatusCompact({ agents, isRunning = false }: AgentStatusPanelProps) {
  return (
    <div className="flex gap-2">
      {Object.entries(AGENT_INFO).map(([type, info]) => {
        const agent = agents.find((a) => a.agentType === type);
        const status = isRunning && !agent ? 'running' : agent?.status || 'idle';

        return (
          <div
            key={type}
            className={`
              flex-1 p-2 rounded text-center transition-all flex flex-col items-center
              ${status === 'running' ? 'bg-yellow-500/20 animate-pulse' :
                status === 'completed' ? 'bg-green-500/20' :
                status === 'error' ? 'bg-red-500/20' :
                'bg-[rgba(255,255,255,0.05)]'}
            `}
            title={`${info.name}: ${status}`}
          >
            <info.icon />
            <div className={`text-xs mt-1 ${getStatusColor(status)}`}>
              {status === 'running' ? '...' :
               status === 'completed' ? '✓' :
               status === 'error' ? '✗' : '-'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
