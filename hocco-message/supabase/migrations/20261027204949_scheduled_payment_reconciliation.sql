create table public.hm_reconciliation_jobs(kind text not null check(kind in ('order','community','sponsor')),code text not null,attempts integer not null default 0,status text not null default 'waiting' check(status in ('waiting','running','done','expired')),lease uuid,locked_until timestamptz,next_attempt_at timestamptz not null default now()+interval '2 minutes',last_error text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(kind,code));
alter table public.hm_reconciliation_jobs enable row level security;
revoke all on public.hm_reconciliation_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.hm_reconciliation_jobs to service_role;
create index hm_reconciliation_due_idx on public.hm_reconciliation_jobs(next_attempt_at) where status in ('waiting','running');
create function public.hm_enqueue_reconciliation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.payment='pending' and coalesce(to_jsonb(new)->>'is_demo','false')<>'true' then
  insert into public.hm_reconciliation_jobs(kind,code) values(case tg_table_name when 'hm_orders' then 'order' when 'hm_sponsors' then 'sponsor' else 'community' end,new.code) on conflict do nothing;
 end if;return new;
end $$;
revoke all on function public.hm_enqueue_reconciliation() from public,anon,authenticated;
grant execute on function public.hm_enqueue_reconciliation() to service_role;
create trigger hm_order_reconcile after insert on public.hm_orders for each row execute function public.hm_enqueue_reconciliation();
create trigger hm_community_reconcile after insert on public.hm_community_messages for each row execute function public.hm_enqueue_reconciliation();
create trigger hm_sponsor_reconcile after insert on public.hm_sponsors for each row execute function public.hm_enqueue_reconciliation();
insert into public.hm_reconciliation_jobs(kind,code,created_at)
 select 'order',code,created_at from public.hm_orders where payment='pending' and not is_demo and created_at>now()-interval '7 days'
 union all select 'community',code,created_at from public.hm_community_messages where payment='pending' and created_at>now()-interval '7 days'
 union all select 'sponsor',code,created_at from public.hm_sponsors where payment='pending' and created_at>now()-interval '7 days' on conflict do nothing;
create function public.hm_server_authorize(p_auth_hash text) returns boolean language sql security invoker set search_path='' as $$select exists(select 1 from public.hm_geo_config where id=1 and report_token_hash=p_auth_hash)$$;
revoke all on function public.hm_server_authorize(text) from public,anon,authenticated;
grant execute on function public.hm_server_authorize(text) to service_role;
create function public.hm_claim_reconciliation(p_limit integer default 10) returns setof public.hm_reconciliation_jobs language plpgsql security invoker set search_path='' as $$
begin
 update public.hm_reconciliation_jobs set status='expired',updated_at=now(),last_error='Prazo de recuperação automática encerrado; conferir no financeiro se necessário.' where status in ('waiting','running') and created_at<now()-interval '7 days';
 return query with due as(select kind,code from public.hm_reconciliation_jobs where status in ('waiting','running') and next_attempt_at<=now() and (locked_until is null or locked_until<now()) order by next_attempt_at limit greatest(1,least(p_limit,20)) for update skip locked)
 update public.hm_reconciliation_jobs j set status='running',lease=gen_random_uuid(),locked_until=now()+interval '4 minutes',attempts=j.attempts+1,updated_at=now() from due d where j.kind=d.kind and j.code=d.code returning j.*;
end $$;
revoke all on function public.hm_claim_reconciliation(integer) from public,anon,authenticated;
grant execute on function public.hm_claim_reconciliation(integer) to service_role;
create function public.hm_finish_reconciliation(p_kind text,p_code text,p_lease uuid,p_done boolean,p_error text) returns void language sql security invoker set search_path='' as $$
 update public.hm_reconciliation_jobs set status=case when p_done then 'done' else 'waiting' end,locked_until=null,lease=null,next_attempt_at=now()+make_interval(mins=>least(60,5*greatest(1,attempts))),last_error=left(coalesce(p_error,''),250),updated_at=now() where kind=p_kind and code=p_code and lease=p_lease and status='running';
$$;
revoke all on function public.hm_finish_reconciliation(text,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.hm_finish_reconciliation(text,text,uuid,boolean,text) to service_role;
