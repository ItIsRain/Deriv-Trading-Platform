'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  initTracking,
  trackPageView,
  trackClick,
  trackEvent,
  getSessionId,
  getVisitorId,
} from '@/lib/tracking';

interface TrackingProviderProps {
  children: React.ReactNode;
  referralCode?: string;
}

export function TrackingProvider({ children, referralCode }: TrackingProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const lastPathname = useRef<string | null>(null);

  // Initialize tracking on mount
  useEffect(() => {
    if (!initialized.current) {
      initTracking(referralCode);
      initialized.current = true;

      // Log session info in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[Tracking] Initialized', {
          visitorId: getVisitorId(),
          sessionId: getSessionId(),
          referralCode,
        });
      }
    }
  }, [referralCode]);

  // Track page views on route change
  useEffect(() => {
    if (pathname !== lastPathname.current) {
      lastPathname.current = pathname;
      trackPageView(referralCode);
    }
  }, [pathname, searchParams, referralCode]);

  // Set up global click tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Track clicks on buttons and links
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
        const element = target.closest('button') || target.closest('a') || target;
        const id = element.id || element.getAttribute('data-track-id') || undefined;
        const text = element.textContent?.trim().slice(0, 50) || undefined;

        // Only track if element has tracking attribute or is a primary action
        if (element.hasAttribute('data-track') || element.classList.contains('primary-btn')) {
          trackClick(id || 'unknown', text, referralCode);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [referralCode]);

  return <>{children}</>;
}

// Hook to track events manually
export function useTracking(referralCode?: string) {
  return {
    trackPageView: () => trackPageView(referralCode),
    trackClick: (elementId: string, elementText?: string) => trackClick(elementId, elementText, referralCode),
    trackEvent: (eventName: string, eventData?: Record<string, unknown>) => trackEvent(eventName, eventData, referralCode),
    getSessionId,
    getVisitorId,
  };
}

export default TrackingProvider;
