-- Spindle migration 002: follow-up callbacks.
-- Run once in Supabase > SQL Editor. Safe to re-run.
-- Until it runs, the app works but hides follow-ups (/health shows a warning).

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS follow_up_done BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calls_follow_up
  ON public.calls (follow_up_at)
  WHERE follow_up_at IS NOT NULL AND follow_up_done = false;
