-- LunarGraph Trading Platform - Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/nztcchgtsptcugovdlza/sql

-- Partners table (main account holders)
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  deriv_token TEXT,
  balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Affiliates table (invited by partners)
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  deriv_token TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 0.10,
  total_earnings DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients table (invited by affiliates via referral link)
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  deriv_account_id TEXT,
  deriv_token TEXT,
  ip_address TEXT,
  device_id TEXT,
  total_traded DECIMAL(15,2) DEFAULT 0,
  total_pnl DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  contract_id BIGINT,
  contract_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  buy_price DECIMAL(15,4),
  sell_price DECIMAL(15,4),
  profit DECIMAL(15,4),
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Invites tracking table (tracks clicks and signups per referral code)
CREATE TABLE IF NOT EXISTS invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  click_count INT DEFAULT 0,
  signup_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page visits / analytics
CREATE TABLE IF NOT EXISTS visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_partner_id ON affiliates(partner_id);
CREATE INDEX IF NOT EXISTS idx_clients_affiliate_id ON clients(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_clients_referral_code ON clients(referral_code);
CREATE INDEX IF NOT EXISTS idx_trades_client_id ON trades(client_id);
CREATE INDEX IF NOT EXISTS idx_trades_affiliate_id ON trades(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_referral_code ON visits(referral_code);
CREATE INDEX IF NOT EXISTS idx_invites_referral_code ON invites(referral_code);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public demo access (adjust for production with proper auth)
-- Affiliates: public read
DROP POLICY IF EXISTS "Allow public read affiliates" ON affiliates;
CREATE POLICY "Allow public read affiliates" ON affiliates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert affiliates" ON affiliates;
CREATE POLICY "Allow public insert affiliates" ON affiliates FOR INSERT WITH CHECK (true);

-- Clients: public read/insert
DROP POLICY IF EXISTS "Allow public read clients" ON clients;
CREATE POLICY "Allow public read clients" ON clients FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert clients" ON clients;
CREATE POLICY "Allow public insert clients" ON clients FOR INSERT WITH CHECK (true);

-- Trades: public CRUD
DROP POLICY IF EXISTS "Allow public read trades" ON trades;
CREATE POLICY "Allow public read trades" ON trades FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert trades" ON trades;
CREATE POLICY "Allow public insert trades" ON trades FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update trades" ON trades;
CREATE POLICY "Allow public update trades" ON trades FOR UPDATE USING (true);

-- Invites: public CRUD
DROP POLICY IF EXISTS "Allow public read invites" ON invites;
CREATE POLICY "Allow public read invites" ON invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert invites" ON invites;
CREATE POLICY "Allow public insert invites" ON invites FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update invites" ON invites;
CREATE POLICY "Allow public update invites" ON invites FOR UPDATE USING (true);

-- Visits: public insert only (analytics)
DROP POLICY IF EXISTS "Allow public insert visits" ON visits;
CREATE POLICY "Allow public insert visits" ON visits FOR INSERT WITH CHECK (true);

-- Create a test affiliate for demo purposes
INSERT INTO affiliates (referral_code, name, email)
VALUES ('DEMO2024', 'Demo Affiliate', 'demo@example.com')
ON CONFLICT (referral_code) DO NOTHING;
