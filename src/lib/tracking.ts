// Comprehensive User Tracking Library
// Tracks visits, IPs, user agents, referrals, and all trackable user data

import { v4 as uuidv4 } from 'uuid';

// Session ID persists across page navigations
let sessionId: string | null = null;
let visitorId: string | null = null;

// Get or create session ID
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  if (!sessionId) {
    sessionId = sessionStorage.getItem('tracking_session_id');
    if (!sessionId) {
      sessionId = uuidv4();
      sessionStorage.setItem('tracking_session_id', sessionId);
    }
  }
  return sessionId;
}

// Get or create persistent visitor ID
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  if (!visitorId) {
    visitorId = localStorage.getItem('tracking_visitor_id');
    if (!visitorId) {
      visitorId = uuidv4();
      localStorage.setItem('tracking_visitor_id', visitorId);
    }
  }
  return visitorId;
}

// Tracking data interface
export interface TrackingData {
  // Core identifiers
  visitorId: string;
  sessionId: string;
  referralCode?: string;

  // Event info
  eventType: 'pageview' | 'click' | 'scroll' | 'form_submit' | 'trade' | 'signup' | 'custom';
  eventName?: string;
  eventData?: Record<string, unknown>;

  // Page info
  page: string;
  pageTitle: string;
  previousPage?: string;

  // Referral info
  referrer: string;
  referrerDomain?: string;

  // UTM parameters
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;

  // Device info
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  deviceVendor?: string;
  deviceModel?: string;

  // Screen info
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  colorDepth: number;
  pixelRatio: number;
  orientation: string;

  // Location/Locale
  language: string;
  languages: string[];
  timezone: string;
  timezoneOffset: number;

  // Connection info
  connectionType?: string;
  connectionEffectiveType?: string;
  connectionDownlink?: number;

  // Performance metrics
  pageLoadTime?: number;
  domContentLoadedTime?: number;
  firstPaintTime?: number;
  firstContentfulPaintTime?: number;

  // Engagement metrics
  scrollDepth?: number;
  timeOnPage?: number;

  // Technical info
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  javaEnabled: boolean;
  touchSupport: boolean;
  maxTouchPoints: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;

  // Canvas fingerprint (for fraud detection)
  canvasFingerprint?: string;

  // Timestamp
  timestamp: string;
  localTime: string;
}

// Parse user agent to extract browser/OS info
function parseUserAgent(ua: string): {
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
  deviceVendor?: string;
  deviceModel?: string;
} {
  const browserName = (() => {
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    if (ua.includes('MSIE') || ua.includes('Trident')) return 'Internet Explorer';
    return 'Unknown';
  })();

  const browserVersion = (() => {
    const patterns: Record<string, RegExp> = {
      Firefox: /Firefox\/(\d+\.?\d*)/,
      Edge: /Edg\/(\d+\.?\d*)/,
      Chrome: /Chrome\/(\d+\.?\d*)/,
      Safari: /Version\/(\d+\.?\d*)/,
      Opera: /(?:Opera|OPR)\/(\d+\.?\d*)/,
    };
    const match = ua.match(patterns[browserName] || /(\d+\.?\d*)/);
    return match ? match[1] : 'Unknown';
  })();

  const osName = (() => {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown';
  })();

  const osVersion = (() => {
    const patterns: Record<string, RegExp> = {
      Windows: /Windows NT (\d+\.?\d*)/,
      macOS: /Mac OS X (\d+[._]\d+)/,
      Android: /Android (\d+\.?\d*)/,
      iOS: /(?:iPhone|iPad).+?OS (\d+[._]\d+)/,
    };
    const match = ua.match(patterns[osName] || /(\d+\.?\d*)/);
    return match ? match[1].replace(/_/g, '.') : 'Unknown';
  })();

  const deviceType = (() => {
    if (/Tablet|iPad/i.test(ua)) return 'tablet' as const;
    if (/Mobile|iPhone|Android(?!.*Tablet)/i.test(ua)) return 'mobile' as const;
    return 'desktop' as const;
  })();

  const deviceVendor = (() => {
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('Mac')) return 'Apple';
    if (ua.includes('Samsung')) return 'Samsung';
    if (ua.includes('Huawei')) return 'Huawei';
    if (ua.includes('Xiaomi')) return 'Xiaomi';
    if (ua.includes('OPPO')) return 'OPPO';
    if (ua.includes('vivo')) return 'Vivo';
    return undefined;
  })();

  return { browserName, browserVersion, osName, osVersion, deviceType, deviceVendor };
}

// Extract UTM parameters from URL
function getUtmParams(): Record<string, string | undefined> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmTerm: params.get('utm_term') || undefined,
    utmContent: params.get('utm_content') || undefined,
  };
}

// Get connection info
function getConnectionInfo(): Record<string, unknown> {
  if (typeof window === 'undefined' || !('connection' in navigator)) return {};

  const conn = (navigator as any).connection;
  return {
    connectionType: conn?.type,
    connectionEffectiveType: conn?.effectiveType,
    connectionDownlink: conn?.downlink,
  };
}

// Get performance metrics
function getPerformanceMetrics(): Record<string, number | undefined> {
  if (typeof window === 'undefined' || !window.performance) return {};

  const timing = performance.timing;
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

  let firstPaint, firstContentfulPaint;
  try {
    const paintEntries = performance.getEntriesByType('paint');
    const fp = paintEntries.find(e => e.name === 'first-paint');
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
    firstPaint = fp?.startTime;
    firstContentfulPaint = fcp?.startTime;
  } catch {
    // Paint timing not available
  }

  return {
    pageLoadTime: navigation?.loadEventEnd ? Math.round(navigation.loadEventEnd) : undefined,
    domContentLoadedTime: navigation?.domContentLoadedEventEnd ? Math.round(navigation.domContentLoadedEventEnd) : undefined,
    firstPaintTime: firstPaint ? Math.round(firstPaint) : undefined,
    firstContentfulPaintTime: firstContentfulPaint ? Math.round(firstContentfulPaint) : undefined,
  };
}

// Generate canvas fingerprint for fraud detection
function getCanvasFingerprint(): string {
  if (typeof window === 'undefined') return '';

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = 200;
    canvas.height = 50;

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('Tracking fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Tracking fingerprint', 4, 17);

    const dataUrl = canvas.toDataURL();
    // Simple hash of the data URL
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      const char = dataUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  } catch {
    return '';
  }
}

// Get referrer domain
function getReferrerDomain(referrer: string): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname;
  } catch {
    return undefined;
  }
}

// Collect all tracking data
export function collectTrackingData(
  eventType: TrackingData['eventType'],
  eventName?: string,
  eventData?: Record<string, unknown>,
  referralCode?: string
): TrackingData {
  if (typeof window === 'undefined') {
    return {} as TrackingData;
  }

  const ua = navigator.userAgent;
  const parsedUa = parseUserAgent(ua);
  const utmParams = getUtmParams();
  const connectionInfo = getConnectionInfo();
  const performanceMetrics = getPerformanceMetrics();

  return {
    // Core identifiers
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    referralCode,

    // Event info
    eventType,
    eventName,
    eventData,

    // Page info
    page: window.location.pathname,
    pageTitle: document.title,
    previousPage: document.referrer && document.referrer.includes(window.location.origin)
      ? new URL(document.referrer).pathname
      : undefined,

    // Referral info
    referrer: document.referrer,
    referrerDomain: getReferrerDomain(document.referrer),

    // UTM parameters
    ...utmParams,

    // Device info
    userAgent: ua,
    ...parsedUa,

    // Screen info
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
    orientation: screen.orientation?.type || 'unknown',

    // Location/Locale
    language: navigator.language,
    languages: Array.from(navigator.languages || [navigator.language]),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),

    // Connection info
    ...connectionInfo,

    // Performance metrics
    ...performanceMetrics,

    // Technical info
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1',
    javaEnabled: false, // Deprecated but kept for compatibility
    touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,

    // Canvas fingerprint
    canvasFingerprint: getCanvasFingerprint(),

    // Timestamp
    timestamp: new Date().toISOString(),
    localTime: new Date().toLocaleString(),
  };
}

// Send tracking data to server
export async function sendTrackingData(data: TrackingData): Promise<void> {
  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      // Use keepalive to ensure request completes even if page is closing
      keepalive: true,
    });
  } catch (error) {
    console.error('[Tracking] Failed to send tracking data:', error);
  }
}

// Track page view
export async function trackPageView(referralCode?: string): Promise<void> {
  const data = collectTrackingData('pageview', undefined, undefined, referralCode);
  await sendTrackingData(data);
}

// Track click event
export async function trackClick(
  elementId: string,
  elementText?: string,
  referralCode?: string
): Promise<void> {
  const data = collectTrackingData('click', 'click', { elementId, elementText }, referralCode);
  await sendTrackingData(data);
}

// Track form submission
export async function trackFormSubmit(
  formId: string,
  formData?: Record<string, unknown>,
  referralCode?: string
): Promise<void> {
  const data = collectTrackingData('form_submit', 'form_submit', { formId, ...formData }, referralCode);
  await sendTrackingData(data);
}

// Track custom event
export async function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>,
  referralCode?: string
): Promise<void> {
  const data = collectTrackingData('custom', eventName, eventData, referralCode);
  await sendTrackingData(data);
}

// Track scroll depth
let maxScrollDepth = 0;
export function initScrollTracking(): void {
  if (typeof window === 'undefined') return;

  const handleScroll = () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const depth = Math.round((scrolled / scrollHeight) * 100);

    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
}

// Get current scroll depth
export function getScrollDepth(): number {
  return maxScrollDepth;
}

// Track time on page
let pageStartTime: number | null = null;

export function initTimeTracking(): void {
  if (typeof window === 'undefined') return;
  pageStartTime = Date.now();
}

export function getTimeOnPage(): number {
  if (!pageStartTime) return 0;
  return Math.round((Date.now() - pageStartTime) / 1000);
}

// Send engagement data before page unload
export function initUnloadTracking(referralCode?: string): void {
  if (typeof window === 'undefined') return;

  const sendEngagementData = () => {
    const data = collectTrackingData('pageview', 'page_exit', {
      scrollDepth: getScrollDepth(),
      timeOnPage: getTimeOnPage(),
    }, referralCode);

    // Use sendBeacon for reliable delivery on page close
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', JSON.stringify(data));
    } else {
      sendTrackingData(data);
    }
  };

  window.addEventListener('beforeunload', sendEngagementData);
  window.addEventListener('pagehide', sendEngagementData);
}

// Initialize all tracking
export function initTracking(referralCode?: string): void {
  if (typeof window === 'undefined') return;

  initTimeTracking();
  initScrollTracking();
  initUnloadTracking(referralCode);

  // Track initial page view
  trackPageView(referralCode);
}
