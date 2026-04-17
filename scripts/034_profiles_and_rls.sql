-- Migration 034: Profiles + RLS
-- Creates public.profiles linking auth.users -> role/business/location/driver,
-- auto-creates profiles on signup via trigger, and enables RLS on all
-- user-facing tables with admin / business / driver policies.
-- Run via Supabase SQL editor — applied 2026-04-17.

-- (See v0-project/scripts/034 contents; mirrored to DB already)
