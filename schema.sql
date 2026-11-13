-- Meridian Call Copilot - Supabase / PostgreSQL schema
-- Paste into Supabase Studio > SQL Editor > Run.
--
-- Two tables. The backend talks to them through PostgREST with the service_role
-- key, which never reaches the browser.

create extension if not exists "pgcrypto";

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  prospect_name text not null,
  prospect_role text,
  company_name text not null,
  company_kind text default 'mid-size private company',
  call_type text default 'first call',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int not null default 0,
  highest_stage_reached int not null default 1 check (highest_stage_reached between 1 and 8),
  highest_stage_name text not null default 'Opening',
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'dropped')),
  outcome text check (outcome in (
    'next_step_agreed',
    'agreed_to_receive_report',
    'interested',
    'follow_up',
    'call_again',
    'not_interested',
    'do_not_call',
    'wrong_person',
    'moved_company',
    'not_logged'
  )),
  next_step text,
  stage5_need_quote text,
  ai_summary text,
  audit_warning text
);

create table if not exists call_stage_logs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  stage_number int not null check (stage_number between 1 and 8),
  stage_name text not null,
  what_happened text not null,
  prospect_words text,
  ai_suggestion text,
  created_at timestamptz not null default now(),
  unique (call_id, stage_number)
);

create index if not exists idx_calls_started_at on calls(started_at desc);
create index if not exists idx_stage_logs_call_id on call_stage_logs(call_id);

-- The browser never reads these tables. Only the service_role key used by the
-- Render backend bypasses RLS, which is the point: prospect words are not
-- public data. If you ever switch the backend to the anon key, add policies.
alter table calls enable row level security;
alter table call_stage_logs enable row level security;

-- Where calls end, without loading every row.
create or replace view public.calls_by_end_stage as
select highest_stage_reached as stage, count(*) as calls
from public.calls
where status <> 'in_progress'
group by highest_stage_reached
order by highest_stage_reached;

create or replace view public.outcome_counts as
select outcome, count(*) as calls
from public.calls
where outcome is not null
group by outcome
order by calls desc;
