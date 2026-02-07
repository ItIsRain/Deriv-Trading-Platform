'use client';

import { LunarAlert, FraudSeverity } from '@/types/lunar-graph';

interface AlertFeedProps {
  alerts: LunarAlert[];
  onAlertClick?: (alert: LunarAlert) => void;
  onAcknowledge?: (alertId: string) => void;
  maxItems?: number;
}

function getSeverityStyles(severity: FraudSeverity): {
  bg: string;
  border: string;
  icon: string;
  iconBg: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        icon: '!',
        iconBg: 'bg-red-500',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        icon: '!!',
        iconBg: 'bg-orange-500',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30',
        icon: '!',
        iconBg: 'bg-yellow-500',
      };
    default:
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        icon: 'i',
        iconBg: 'bg-blue-500',
      };
  }
}

function AlertTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'new_fraud_ring':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
    case 'risk_escalation':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      );
    case 'pattern_detected':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      );
    case 'entity_flagged':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      );
    case 'threshold_breach':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      );
  }
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function AlertFeed({
  alerts,
  onAlertClick,
  onAcknowledge,
  maxItems = 20,
}: AlertFeedProps) {
  const displayAlerts = alerts.slice(0, maxItems);

  if (displayAlerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
          <span className="text-xl">✓</span>
        </div>
        <p className="text-gray-400 text-sm">No active alerts</p>
        <p className="text-gray-500 text-xs mt-1">Run an analysis to detect issues</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto">
      {displayAlerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity);
        const isNew = !alert.acknowledged && Date.now() - new Date(alert.createdAt).getTime() < 300000; // 5 min

        return (
          <div
            key={alert.id}
            onClick={() => onAlertClick?.(alert)}
            className={`
              relative p-3 rounded-lg cursor-pointer transition-all
              ${styles.bg} border ${styles.border}
              ${alert.acknowledged ? 'opacity-60' : ''}
              hover:border-white/30
            `}
          >
            {/* New indicator */}
            {isNew && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            )}

            {/* Header */}
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0"><AlertTypeIcon type={alert.type} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`
                      px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase
                      ${styles.iconBg} text-white
                    `}
                  >
                    {alert.severity}
                  </span>
                  <span className="text-xs text-gray-500">{formatTimeAgo(alert.createdAt)}</span>
                </div>
                <h4 className="text-sm font-medium text-white mt-1 line-clamp-1">{alert.title}</h4>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{alert.description}</p>
              </div>
            </div>

            {/* Entity count */}
            {alert.entities.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {alert.entities.length} entities involved
                </span>
                {alert.fraudRingId && (
                  <span className="text-xs text-red-400">• Linked to fraud ring</span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAlertClick?.(alert);
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View Details
              </button>
              {!alert.acknowledged && onAcknowledge && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAcknowledge(alert.id);
                  }}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        );
      })}

      {alerts.length > maxItems && (
        <div className="text-center py-2">
          <span className="text-xs text-gray-500">
            +{alerts.length - maxItems} more alerts
          </span>
        </div>
      )}
    </div>
  );
}

// Summary component for dashboard
export function AlertSummary({ alerts }: { alerts: LunarAlert[] }) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const critical = unacknowledged.filter((a) => a.severity === 'critical').length;
  const high = unacknowledged.filter((a) => a.severity === 'high').length;
  const medium = unacknowledged.filter((a) => a.severity === 'medium').length;

  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <div className="bg-[rgba(255,255,255,0.05)] rounded p-2">
        <div className="text-lg font-bold text-white">{unacknowledged.length}</div>
        <div className="text-xs text-gray-400">Active</div>
      </div>
      <div className="bg-red-500/10 rounded p-2">
        <div className="text-lg font-bold text-red-400">{critical}</div>
        <div className="text-xs text-gray-400">Critical</div>
      </div>
      <div className="bg-orange-500/10 rounded p-2">
        <div className="text-lg font-bold text-orange-400">{high}</div>
        <div className="text-xs text-gray-400">High</div>
      </div>
      <div className="bg-yellow-500/10 rounded p-2">
        <div className="text-lg font-bold text-yellow-400">{medium}</div>
        <div className="text-xs text-gray-400">Medium</div>
      </div>
    </div>
  );
}
