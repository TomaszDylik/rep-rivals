-- Migration: add points multiplier system to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS points_multiplier numeric DEFAULT 1.0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS base_unit text; -- e.g. '10 kg', '1 km', '25 m'
