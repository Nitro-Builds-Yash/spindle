-- =========================================================
-- Meridian Call Copilot - Supabase Database Setup
-- Run this ENTIRE block in Supabase > SQL Editor
-- (Make sure NO partial text is selected before clicking Run)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Calls Table
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_name TEXT NOT NULL DEFAULT '',
    prospect_role TEXT DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    company_kind TEXT DEFAULT 'mid-size private company',
    call_type TEXT DEFAULT 'first call',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT NOT NULL DEFAULT 0,
    highest_stage_reached INT NOT NULL DEFAULT 1 CHECK (highest_stage_reached BETWEEN 1 AND 8),
    highest_stage_name TEXT NOT NULL DEFAULT 'Opening',
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'dropped')),
    outcome TEXT,
    next_step TEXT,
    stage5_need_quote TEXT,
    ai_summary TEXT,
    audit_warning TEXT
);

-- 2. Call Stage Logs Table
CREATE TABLE IF NOT EXISTS public.call_stage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
    stage_number INT NOT NULL CHECK (stage_number BETWEEN 1 AND 8),
    stage_name TEXT NOT NULL DEFAULT '',
    what_happened TEXT NOT NULL DEFAULT '',
    prospect_words TEXT DEFAULT '',
    ai_suggestion TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (call_id, stage_number)
);

-- 3. Indexes for fast dashboard sorting & lookups
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON public.calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_logs_call_id ON public.call_stage_logs(call_id);

-- 4. Enable RLS and add allow-all service access policies
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_stage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow backend full access to calls" ON public.calls;
CREATE POLICY "Allow backend full access to calls" ON public.calls FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow backend full access to stage logs" ON public.call_stage_logs;
CREATE POLICY "Allow backend full access to stage logs" ON public.call_stage_logs FOR ALL USING (true) WITH CHECK (true);

-- 5. Analytical Views for Funnel & Outcomes
CREATE OR REPLACE VIEW public.calls_by_end_stage AS
SELECT highest_stage_reached AS stage, COUNT(*) AS calls
FROM public.calls
WHERE status <> 'in_progress'
GROUP BY highest_stage_reached
ORDER BY highest_stage_reached;

CREATE OR REPLACE VIEW public.outcome_counts AS
SELECT outcome, COUNT(*) AS calls
FROM public.calls
WHERE outcome IS NOT NULL
GROUP BY outcome
ORDER BY calls DESC;
