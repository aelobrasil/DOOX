create table if not exists public.hm_live_sessions (
  id uuid primary key default gen_random_uuid(),
  scheduled_at timestamptz not null,
  title text not null default 'HOCCO LIVE',
  url text not null,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists hm_live_sessions_scheduled_at_uq on public.hm_live_sessions(scheduled_at);
create table if not exists public.hm_live_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.hm_live_sessions(id) on delete cascade,
  message_id uuid not null references public.hm_community_messages(id) on delete cascade,
  device_hash text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique(live_id,message_id)
);
create index if not exists hm_live_notification_deliveries_device_idx on public.hm_live_notification_deliveries(device_hash);
alter table public.hm_programming add column if not exists active_live_id uuid references public.hm_live_sessions(id);
alter table public.hm_programming add column if not exists live_started_at timestamptz;
alter table public.hm_community_messages add column if not exists live_session_id uuid references public.hm_live_sessions(id);
alter table public.hm_live_sessions enable row level security;
alter table public.hm_live_notification_deliveries enable row level security;
revoke all on public.hm_live_sessions from anon, authenticated;
revoke all on public.hm_live_notification_deliveries from anon, authenticated;