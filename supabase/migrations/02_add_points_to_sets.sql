-- Migration: add points column to sets table
ALTER TABLE sets ADD COLUMN IF NOT EXISTS points numeric DEFAULT 0;
