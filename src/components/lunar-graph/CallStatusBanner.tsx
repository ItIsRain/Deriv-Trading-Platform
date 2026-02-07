'use client';

import React, { useEffect, useState, useCallback } from 'react';

export type CallStatus = 'pending' | 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';

interface CallStatusBannerProps {
  callId: string;
  phoneNumber: string;
  initialStatus?: CallStatus;
  onClose?: () => void;
  onStatusChange?: (status: CallStatus) => void;
}

const STATUS_CONFIG: Record<CallStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  animate?: boolean;
}> = {
  pending: {
    label: 'Preparing call...',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    icon: 'hourglass',
    animate: true,
  },
  initiated: {
    label: 'Call initiated',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: 'phone',
    animate: true,
  },
  ringing: {
    label: 'Ringing...',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    icon: 'phone-ringing',
    animate: true,
  },
  'in-progress': {
    label: 'Call in progress',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    icon: 'phone-call',
    animate: true,
  },
  completed: {
    label: 'Call completed',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10 border-gray-500/30',
    icon: 'phone-check',
    animate: false,
  },
  failed: {
    label: 'Call failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    icon: 'phone-x',
    animate: false,
  },
};

function CallIcon({ status }: { status: CallStatus }) {
  const config = STATUS_CONFIG[status];

  // Simple SVG icons for call states
  const icons: Record<string, JSX.Element> = {
    hourglass: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2v6l4 4-4 4v6h12v-6l-4-4 4-4V2H6z" />
      </svg>
    ),
    phone: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
    'phone-ringing': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        <path d="M14.5 2c1.95.84 3.4 2.3 4.24 4.24" />
        <path d="M14.5 6c.95.42 1.7 1.17 2.12 2.12" />
      </svg>
    ),
    'phone-call': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        <circle cx="18" cy="6" r="3" fill="currentColor" />
      </svg>
    ),
    'phone-check': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        <path d="M14 8l2 2 4-4" />
      </svg>
    ),
    'phone-x': (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
        <path d="M14 4l4 4m0-4l-4 4" />
      </svg>
    ),
  };

  return (
    <span className={`${config.color} ${config.animate ? 'animate-pulse' : ''}`}>
      {icons[config.icon]}
    </span>
  );
}

export default function CallStatusBanner({
  callId,
  phoneNumber,
  initialStatus = 'pending',
  onClose,
  onStatusChange,
}: CallStatusBannerProps) {
  const [status, setStatus] = useState<CallStatus>(initialStatus);
  const [isVisible, setIsVisible] = useState(true);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Poll for status updates
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/lunar-graph/smart-call/status?callId=${callId}`);
      const data = await response.json();

      if (data.success && data.call) {
        const newStatus = data.call.status as CallStatus;
        if (newStatus !== status) {
          setStatus(newStatus);
          onStatusChange?.(newStatus);
        }

        // Stop polling if call is complete or failed
        if (newStatus === 'completed' || newStatus === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('[CallStatusBanner] Error checking status:', error);
    }
  }, [callId, status, onStatusChange, pollInterval]);

  // Start polling when component mounts
  useEffect(() => {
    // Initial check
    checkStatus();

    // Set up polling every 3 seconds
    const interval = setInterval(checkStatus, 3000);
    setPollInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [callId]); // Only re-run if callId changes

  // Auto-hide after completion
  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      const timeout = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [status, onClose]);

  if (!isVisible) return null;

  const config = STATUS_CONFIG[status];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.bgColor} transition-all duration-300`}>
      <CallIcon status={status} />

      <div className="flex-1">
        <div className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </div>
        <div className="text-xs text-gray-400">
          {phoneNumber}
        </div>
      </div>

      {(status === 'completed' || status === 'failed') && (
        <button
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {config.animate && (
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
