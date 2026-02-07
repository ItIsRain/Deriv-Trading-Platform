'use client';

import { FraudRing, FraudSeverity } from '@/types/lunar-graph';

interface FraudRingCardProps {
  ring: FraudRing;
  onClick?: () => void;
  isSelected?: boolean;
}

function getSeverityColor(severity: FraudSeverity): { bg: string; text: string; border: string } {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' };
    case 'high':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' };
    case 'medium':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
    default:
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' };
  }
}

function formatRingType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function FraudRingCard({ ring, onClick, isSelected = false }: FraudRingCardProps) {
  const colors = getSeverityColor(ring.severity);

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${colors.bg} border ${colors.border}
        ${isSelected ? 'ring-2 ring-white/50' : 'hover:border-white/30'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">{ring.name}</h4>
          <p className="text-xs text-gray-400">{formatRingType(ring.type)}</p>
        </div>
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${colors.text} ${colors.bg}`}>
          {ring.severity.toUpperCase()}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-white font-medium text-sm">{ring.confidence}%</div>
          <div className="text-xs text-gray-500">Confidence</div>
        </div>
        <div>
          <div className="text-white font-medium text-sm">{ring.entities.length}</div>
          <div className="text-xs text-gray-500">Entities</div>
        </div>
        <div>
          <div className="text-white font-medium text-sm">${ring.exposure.toFixed(0)}</div>
          <div className="text-xs text-gray-500">Exposure</div>
        </div>
      </div>

      {/* AI Summary Preview */}
      {ring.aiSummary && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-xs text-gray-400 line-clamp-2">{ring.aiSummary}</p>
        </div>
      )}

      {/* Status */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              ring.status === 'active' ? 'bg-red-500 animate-pulse' :
              ring.status === 'investigating' ? 'bg-yellow-500' :
              ring.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400 capitalize">{ring.status}</span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(ring.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// Compact version for lists
export function FraudRingCardCompact({ ring, onClick, isSelected = false }: FraudRingCardProps) {
  const colors = getSeverityColor(ring.severity);

  return (
    <div
      onClick={onClick}
      className={`
        p-2 rounded cursor-pointer transition-all flex items-center gap-3
        ${colors.bg} border ${colors.border}
        ${isSelected ? 'ring-1 ring-white/50' : 'hover:border-white/30'}
      `}
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          ring.severity === 'critical' ? 'bg-red-500' :
          ring.severity === 'high' ? 'bg-orange-500' :
          ring.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white truncate">{ring.name}</span>
          <span className={`text-xs ${colors.text}`}>{ring.confidence}%</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{ring.entities.length} entities</span>
          <span>${ring.exposure.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}
