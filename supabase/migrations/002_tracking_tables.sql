-- Comprehensive User Tracking Tables
-- Run this migration in your Supabase SQL editor

-- Main tracking events table
CREATE TABLE IF NOT EXISTS visitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Core identifiers
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  referral_code TEXT,

  -- Event info
  event_type TEXT NOT NULL, -- pageview, click, scroll, form_submit, trade, signup, custom
  event_name TEXT,
  event_data JSONB,

  -- Page info
  page_url TEXT NOT NULL,
  page_title TEXT,
  previous_page TEXT,

  -- Server-side geo data (from IP)
  ip_address TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  asn TEXT,

  -- Referral info
  referrer TEXT,
  referrer_domain TEXT,

  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  -- Device info
  user_agent TEXT,
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  device_type TEXT, -- desktop, tablet, mobile
  device_vendor TEXT,
  device_model TEXT,

  -- Screen info
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  color_depth INTEGER,
  pixel_ratio DECIMAL(4, 2),
  orientation TEXT,

  -- Location/Locale
  language TEXT,
  languages TEXT[],
  timezone TEXT,
  timezone_offset INTEGER,

  -- Connection info
  connection_type TEXT,
  connection_effective_type TEXT,
  connection_downlink DECIMAL(10, 2),

  -- Performance metrics
  page_load_time INTEGER,
  dom_content_loaded_time INTEGER,
  first_paint_time INTEGER,
  first_contentful_paint_time INTEGER,

  -- Engagement metrics
  scroll_depth INTEGER,
  time_on_page INTEGER,

  -- Technical info
  cookies_enabled BOOLEAN,
  do_not_track BOOLEAN,
  java_enabled BOOLEAN,
  touch_support BOOLEAN,
  max_touch_points INTEGER,
  hardware_concurrency INTEGER,
  device_memory DECIMAL(4, 1),

  -- Fingerprinting
  canvas_fingerprint TEXT,

  -- Client timestamps
  client_timestamp TIMESTAMPTZ,
  client_local_time TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tracking_visitor_id ON visitor_tracking(visitor_id);
CREATE INDEX IF NOT EXISTS idx_tracking_session_id ON visitor_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_referral_code ON visitor_tracking(referral_code);
CREATE INDEX IF NOT EXISTS idx_tracking_created_at ON visitor_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_event_type ON visitor_tracking(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_page_url ON visitor_tracking(page_url);
CREATE INDEX IF NOT EXISTS idx_tracking_ip_address ON visitor_tracking(ip_address);
CREATE INDEX IF NOT EXISTS idx_tracking_country ON visitor_tracking(country);

-- Visitor profiles table (aggregated visitor data)
CREATE TABLE IF NOT EXISTS visitor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  visitor_id TEXT UNIQUE NOT NULL,

  -- Visit info
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  visit_count INTEGER DEFAULT 1,

  -- IP tracking
  first_ip TEXT,
  last_ip TEXT,

  -- Page tracking
  first_page TEXT,
  last_page TEXT,
  first_referrer TEXT,

  -- Device info (from first visit)
  user_agent TEXT,
  browser_name TEXT,
  os_name TEXT,
  device_type TEXT,

  -- Location
  country TEXT,
  city TEXT,

  -- Locale
  language TEXT,
  timezone TEXT,

  -- Fingerprinting
  canvas_fingerprint TEXT,

  -- Conversion tracking
  converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_type TEXT, -- signup, trade, etc.

  -- Associated data
  client_id UUID REFERENCES clients(id),
  referral_code TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_visitor_id ON visitor_profiles(visitor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON visitor_profiles(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON visitor_profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_converted ON visitor_profiles(converted);

-- Referral clicks table (tracks clicks on referral links)
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  referral_code TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,

  -- Link to affiliate
  affiliate_id UUID REFERENCES affiliates(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_clicks_referral_code ON referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_clicks_created_at ON referral_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clicks_ip ON referral_clicks(ip_address);

-- Sessions table (for session-level analytics)
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  session_id TEXT UNIQUE NOT NULL,
  visitor_id TEXT NOT NULL,

  -- Session info
  start_page TEXT,
  exit_page TEXT,
  page_count INTEGER DEFAULT 1,

  -- Engagement
  total_time_seconds INTEGER DEFAULT 0,
  max_scroll_depth INTEGER DEFAULT 0,

  -- Source
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Device
  device_type TEXT,
  browser_name TEXT,
  os_name TEXT,

  -- Location
  country TEXT,
  city TEXT,

  -- Conversion
  converted BOOLEAN DEFAULT FALSE,
  conversion_type TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON visitor_sessions(created_at DESC);

-- Page views aggregation view
CREATE OR REPLACE VIEW page_views_daily AS
SELECT
  DATE(created_at) as date,
  page_url,
  COUNT(*) as views,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  COUNT(DISTINCT session_id) as sessions,
  AVG(time_on_page) as avg_time_on_page
FROM visitor_tracking
WHERE event_type = 'pageview'
GROUP BY DATE(created_at), page_url
ORDER BY date DESC, views DESC;

-- Traffic sources view
CREATE OR REPLACE VIEW traffic_sources AS
SELECT
  COALESCE(utm_source, referrer_domain, 'direct') as source,
  utm_medium,
  utm_campaign,
  COUNT(*) as visits,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM visitor_tracking
WHERE event_type = 'pageview'
GROUP BY utm_source, referrer_domain, utm_medium, utm_campaign
ORDER BY visits DESC;

-- Device breakdown view
CREATE OR REPLACE VIEW device_breakdown AS
SELECT
  device_type,
  browser_name,
  os_name,
  COUNT(*) as visits,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM visitor_tracking
WHERE event_type = 'pageview'
GROUP BY device_type, browser_name, os_name
ORDER BY visits DESC;

-- Geographic breakdown view
CREATE OR REPLACE VIEW geo_breakdown AS
SELECT
  country,
  city,
  COUNT(*) as visits,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM visitor_tracking
WHERE event_type = 'pageview' AND country IS NOT NULL
GROUP BY country, city
ORDER BY visits DESC;

-- Enable RLS but allow inserts from service role
ALTER TABLE visitor_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access to tracking" ON visitor_tracking FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to profiles" ON visitor_profiles FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to clicks" ON referral_clicks FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access to sessions" ON visitor_sessions FOR ALL TO service_role USING (true);

-- Allow anon to insert (for tracking API)
CREATE POLICY "Allow anon to insert tracking" ON visitor_tracking FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to insert clicks" ON referral_clicks FOR INSERT TO anon WITH CHECK (true);

COMMENT ON TABLE visitor_tracking IS 'Stores all tracking events from the frontend';
COMMENT ON TABLE visitor_profiles IS 'Aggregated visitor profiles for analytics';
COMMENT ON TABLE referral_clicks IS 'Tracks clicks on referral links';
COMMENT ON TABLE visitor_sessions IS 'Session-level analytics data';
