-- Anonymous daily counts only. No visitor identifier, message, private link or payment data.
create table if not exists public.hm_experience_daily (
 event_day date not null,
 event_name text not null check(event_name in ('participation_open','compose_video','compose_community','compose_live','company_registration','company_review','checkout_open','checkout_error','channel_open','company_directory','order_lookup')),
 total bigint not null default 0 check(total>=0),
 primary key(event_day,event_name)
);
alter table public.hm_experience_daily enable row level security;
revoke all on public.hm_experience_daily from public,anon,authenticated;
grant select,insert,update on public.hm_experience_daily to service_role;
create or replace function public.hm_count_experience(p_event text)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_event is null or p_event not in ('participation_open','compose_video','compose_community','compose_live','company_registration','company_review','checkout_open','checkout_error','channel_open','company_directory','order_lookup') then raise exception 'Invalid experience event';end if;
 insert into public.hm_experience_daily(event_day,event_name,total)
 values((now() at time zone 'America/Sao_Paulo')::date,p_event,1)
 on conflict(event_day,event_name) do update set total=hm_experience_daily.total+1;
end;$$;
revoke all on function public.hm_count_experience(text) from public,anon,authenticated;
grant execute on function public.hm_count_experience(text) to service_role;
create index if not exists hm_city_visits_city_key_idx on public.hm_city_visits(city_key);
create index if not exists hm_community_audit_actor_id_idx on public.hm_community_audit(actor_id);
