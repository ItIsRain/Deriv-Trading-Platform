-- Migration: Fix broadcast_drawings table to support per-affiliate broadcasts
-- Date: 2026-02-07
-- Description: Add referral_code column and update unique constraint to allow
--              multiple affiliates to broadcast the same symbol

-- Add referral_code column if it doesn't exist
ALTER TABLE broadcast_drawings ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Drop the old unique constraint on symbol only
ALTER TABLE broadcast_drawings DROP CONSTRAINT IF EXISTS broadcast_drawings_symbol_key;

-- Add new unique constraint on (referral_code, symbol)
ALTER TABLE broadcast_drawings DROP CONSTRAINT IF EXISTS broadcast_drawings_referral_symbol_unique;
ALTER TABLE broadcast_drawings ADD CONSTRAINT broadcast_drawings_referral_symbol_unique UNIQUE (referral_code, symbol);

-- Add index for referral_code lookups
CREATE INDEX IF NOT EXISTS idx_broadcast_drawings_referral_code ON broadcast_drawings(referral_code);

-- Comment
COMMENT ON COLUMN broadcast_drawings.referral_code IS 'The affiliate referral code who owns this broadcast';
