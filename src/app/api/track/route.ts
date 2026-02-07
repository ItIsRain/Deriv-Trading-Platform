// Tracking API Endpoint
// Receives tracking data from client and stores it in Supabase

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// Type for incoming tracking data
interface TrackingPayload {
  visitorId: string;
  sessionId: string;
  referralCode?: string;
  eventType: string;
  eventName?: string;
  eventData?: Record<string, unknown>;
  page: string;
  pageTitle: string;
  previousPage?: string;
  referrer: string;
  referrerDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  userAgent: string;
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceType: string;
  deviceVendor?: string;
  deviceModel?: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  colorDepth: number;
  pixelRatio: number;
  orientation: string;
  language: string;
  languages: string[];
  timezone: string;
  timezoneOffset: number;
  connectionType?: string;
  connectionEffectiveType?: string;
  connectionDownlink?: number;
  pageLoadTime?: number;
  domContentLoadedTime?: number;
  firstPaintTime?: number;
  firstContentfulPaintTime?: number;
  scrollDepth?: number;
  timeOnPage?: number;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  javaEnabled: boolean;
  touchSupport: boolean;
  maxTouchPoints: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvasFingerprint?: string;
  timestamp: string;
  localTime: string;
}

// Get real IP address from headers
function getClientIp(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to connection info (may be localhost in dev)
  return request.headers.get('x-client-ip') || 'unknown';
}

// Get geo info from Cloudflare headers if available
function getGeoInfo(request: NextRequest): Record<string, string | undefined> {
  return {
    country: request.headers.get('cf-ipcountry') || undefined,
    city: request.headers.get('cf-ipcity') || undefined,
    region: request.headers.get('cf-ipregion') || undefined,
    postalCode: request.headers.get('cf-postal-code') || undefined,
    latitude: request.headers.get('cf-iplat') || undefined,
    longitude: request.headers.get('cf-iplon') || undefined,
    asn: request.headers.get('cf-asn') || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrackingPayload = await request.json();

    // Get server-side data
    const ipAddress = getClientIp(request);
    const geoInfo = getGeoInfo(request);

    // Prepare the data for storage
    const trackingData = {
      // Core identifiers
      visitor_id: payload.visitorId,
      session_id: payload.sessionId,
      referral_code: payload.referralCode || null,

      // Event info
      event_type: payload.eventType,
      event_name: payload.eventName || null,
      event_data: payload.eventData ? JSON.stringify(payload.eventData) : null,

      // Page info
      page_url: payload.page,
      page_title: payload.pageTitle,
      previous_page: payload.previousPage || null,

      // Server-side data
      ip_address: ipAddress,
      country: geoInfo.country || null,
      city: geoInfo.city || null,
      region: geoInfo.region || null,
      postal_code: geoInfo.postalCode || null,
      latitude: geoInfo.latitude ? parseFloat(geoInfo.latitude) : null,
      longitude: geoInfo.longitude ? parseFloat(geoInfo.longitude) : null,
      asn: geoInfo.asn || null,

      // Referral info
      referrer: payload.referrer || null,
      referrer_domain: payload.referrerDomain || null,

      // UTM parameters
      utm_source: payload.utmSource || null,
      utm_medium: payload.utmMedium || null,
      utm_campaign: payload.utmCampaign || null,
      utm_term: payload.utmTerm || null,
      utm_content: payload.utmContent || null,

      // Device info
      user_agent: payload.userAgent,
      browser_name: payload.browserName,
      browser_version: payload.browserVersion,
      os_name: payload.osName,
      os_version: payload.osVersion,
      device_type: payload.deviceType,
      device_vendor: payload.deviceVendor || null,
      device_model: payload.deviceModel || null,

      // Screen info
      screen_width: payload.screenWidth,
      screen_height: payload.screenHeight,
      viewport_width: payload.viewportWidth,
      viewport_height: payload.viewportHeight,
      color_depth: payload.colorDepth,
      pixel_ratio: payload.pixelRatio,
      orientation: payload.orientation,

      // Location/Locale
      language: payload.language,
      languages: payload.languages,
      timezone: payload.timezone,
      timezone_offset: payload.timezoneOffset,

      // Connection info
      connection_type: payload.connectionType || null,
      connection_effective_type: payload.connectionEffectiveType || null,
      connection_downlink: payload.connectionDownlink || null,

      // Performance metrics
      page_load_time: payload.pageLoadTime || null,
      dom_content_loaded_time: payload.domContentLoadedTime || null,
      first_paint_time: payload.firstPaintTime || null,
      first_contentful_paint_time: payload.firstContentfulPaintTime || null,

      // Engagement metrics
      scroll_depth: payload.scrollDepth || null,
      time_on_page: payload.timeOnPage || null,

      // Technical info
      cookies_enabled: payload.cookiesEnabled,
      do_not_track: payload.doNotTrack,
      java_enabled: payload.javaEnabled,
      touch_support: payload.touchSupport,
      max_touch_points: payload.maxTouchPoints,
      hardware_concurrency: payload.hardwareConcurrency || null,
      device_memory: payload.deviceMemory || null,

      // Canvas fingerprint
      canvas_fingerprint: payload.canvasFingerprint || null,

      // Timestamps
      client_timestamp: payload.timestamp,
      client_local_time: payload.localTime,
    };

    // Store in Supabase if configured
    if (isSupabaseConfigured()) {
      const { error } = await (supabaseAdmin as any)
        .from('visitor_tracking')
        .insert(trackingData);

      if (error) {
        console.error('[Tracking API] Supabase error:', error);
        // Don't fail the request, just log the error
      }

      // Also update/create visitor profile
      await updateVisitorProfile(payload.visitorId, ipAddress, payload, geoInfo);

      // Track referral click if referral code is present and this is a pageview
      if (payload.referralCode && payload.eventType === 'pageview') {
        await trackReferralClick(payload.referralCode, ipAddress, payload.userAgent);
      }
    } else {
      // Log to console in development
      console.log('[Tracking API] Would store:', JSON.stringify(trackingData, null, 2));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Tracking API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process tracking data' }, { status: 500 });
  }
}

// Update or create visitor profile
async function updateVisitorProfile(
  visitorId: string,
  ipAddress: string,
  payload: TrackingPayload,
  geoInfo: Record<string, string | undefined>
): Promise<void> {
  try {
    const { data: existing } = await (supabaseAdmin as any)
      .from('visitor_profiles')
      .select('id, visit_count, first_seen_at')
      .eq('visitor_id', visitorId)
      .single();

    if (existing) {
      // Update existing profile
      await (supabaseAdmin as any)
        .from('visitor_profiles')
        .update({
          last_seen_at: new Date().toISOString(),
          last_ip: ipAddress,
          last_page: payload.page,
          visit_count: existing.visit_count + 1,
          country: geoInfo.country || null,
          city: geoInfo.city || null,
        })
        .eq('visitor_id', visitorId);
    } else {
      // Create new profile
      await (supabaseAdmin as any)
        .from('visitor_profiles')
        .insert({
          visitor_id: visitorId,
          first_ip: ipAddress,
          last_ip: ipAddress,
          first_page: payload.page,
          last_page: payload.page,
          first_referrer: payload.referrer || null,
          user_agent: payload.userAgent,
          browser_name: payload.browserName,
          os_name: payload.osName,
          device_type: payload.deviceType,
          country: geoInfo.country || null,
          city: geoInfo.city || null,
          language: payload.language,
          timezone: payload.timezone,
          canvas_fingerprint: payload.canvasFingerprint || null,
          visit_count: 1,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('[Tracking API] Error updating visitor profile:', error);
  }
}

// Track referral click
async function trackReferralClick(
  referralCode: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    // Check if this IP already clicked this referral today (prevent inflation)
    const today = new Date().toISOString().split('T')[0];
    const { data: existingClick } = await (supabaseAdmin as any)
      .from('referral_clicks')
      .select('id')
      .eq('referral_code', referralCode)
      .eq('ip_address', ipAddress)
      .gte('created_at', `${today}T00:00:00`)
      .single();

    if (!existingClick) {
      // Record the click
      await (supabaseAdmin as any)
        .from('referral_clicks')
        .insert({
          referral_code: referralCode,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      // Increment click count in invites table
      const { data: invite } = await (supabaseAdmin as any)
        .from('invites')
        .select('click_count')
        .eq('referral_code', referralCode)
        .single();

      if (invite) {
        await (supabaseAdmin as any)
          .from('invites')
          .update({ click_count: invite.click_count + 1 })
          .eq('referral_code', referralCode);
      }
    }
  } catch (error) {
    console.error('[Tracking API] Error tracking referral click:', error);
  }
}

// Handle GET requests (for beacon fallback)
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'Tracking API is running' });
}
