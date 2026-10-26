create table public.hm_lab_scenarios(id uuid primary key default gen_random_uuid(),actor_id uuid not null,revision integer not null default 0,payload jsonb not null check(payload->>'simulation'='true'),created_at timestamptz not null default now());
alter table public.hm_lab_scenarios enable row level security;
revoke all on public.hm_lab_scenarios from public,anon,authenticated;
grant select,insert,update,delete on public.hm_lab_scenarios to service_role;
create index hm_lab_actor_created on public.hm_lab_scenarios(actor_id,created_at desc);
