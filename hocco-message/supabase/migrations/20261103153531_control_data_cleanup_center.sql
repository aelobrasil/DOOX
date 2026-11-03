begin;
create table public.hm_data_cleanup_settings(id boolean primary key default true check(id),optional_enabled boolean not null default true,updated_at timestamptz not null default now(),updated_by uuid,last_run_at timestamptz,last_result jsonb not null default '{}');
insert into public.hm_data_cleanup_settings(id) values(true);
alter table public.hm_data_cleanup_settings enable row level security;
revoke all on public.hm_data_cleanup_settings from public,anon,authenticated;
grant select,update on public.hm_data_cleanup_settings to service_role;
create index if not exists hm_alex_reports_cleanup_date_idx on public.hm_alex_reports(generated_at);
create index if not exists hm_alex_views_cleanup_date_idx on public.hm_alex_events(created_at) where event_type='site_view';
-- Definer is scoped to an authenticated active team actor and service-only execution:
-- service_role cannot read the cron schema directly. Return only aggregate counts and allowlisted job health.
create function public.hm_data_cleanup_status(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.hm_data_cleanup_settings;unpaid bigint;content bigint;expired_evidence bigint;protected_evidence bigint;reports bigint;visits bigint;jobs jsonb;
begin
 if p_actor is null or not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 select * into cfg from public.hm_data_cleanup_settings where id=true;
 select count(*) into unpaid from (
  select o.id from public.hm_orders o where o.payment='pending' and not o.payment_hold and o.mercado_pago_payment_id is null and o.created_at<=now()-interval '20 minutes' and not o.is_demo and o.delivery<>'published' and not exists(select 1 from public.hm_payments p where p.order_id=o.id or p.kind='order' and p.code=o.code)
  union all
  select c.id from public.hm_community_messages c where c.payment='pending' and not c.payment_hold and c.mercado_pago_payment_id is null and c.created_at<=now()-interval '20 minutes' and c.published_at is null and not exists(select 1 from public.hm_payments p where p.order_id=c.id or p.kind='community' and p.code=c.code)
 ) due;
 select count(*) into content from public.hm_community_messages c where public.hm_community_content_removable(c,true);
 select count(*) filter(where expires_at<=now()),count(*) filter(where expires_at>now()) into expired_evidence,protected_evidence from public.hm_sender_evidence;
 select count(*) into reports from public.hm_alex_reports where generated_at<now()-interval '30 days';
 select count(*) into visits from public.hm_alex_events where event_type='site_view' and created_at<now()-interval '30 days';
 select coalesce(jsonb_agg(jsonb_build_object('name',j.jobname,'enabled',j.active,'schedule',j.schedule,'lastStatus',r.status,'lastFinished',r.end_time) order by j.jobname),'[]') into jobs from cron.job j left join lateral(select status,end_time from cron.job_run_details where jobid=j.jobid order by runid desc limit 1) r on true where j.jobname in ('hocco-expire-unpaid-comments','hocco-community-content-retention','hocco-sender-evidence-48h','hocco-message-data-cleanup');
 return jsonb_build_object('optionalEnabled',cfg.optional_enabled,'lastRun',cfg.last_run_at,'lastResult',cfg.last_result,'eligible',jsonb_build_object('unpaid',unpaid,'content',content,'senderExpired',expired_evidence,'reports',reports,'visits',visits),'protected',jsonb_build_object('senders',protected_evidence,'payments',(select count(*) from public.hm_payments),'liveQueue',(select count(*) from public.hm_community_messages where destination='live' and live_status='queued' and payment='confirmed'),'financialAttention',(select count(*) from public.hm_payments where needs_attention)),'jobs',jobs);
end $$;
create function public.hm_update_cleanup_preferences(p_actor uuid,p_enabled boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if p_actor is null or not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 if p_enabled is null then raise exception 'Escolha se deseja automatizar relatórios e acessos antigos.';end if;
 update public.hm_data_cleanup_settings set optional_enabled=p_enabled,updated_at=now(),updated_by=p_actor where id=true;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'data_cleanup_preferences',jsonb_build_object('optionalEnabled',p_enabled));
 return jsonb_build_object('optionalEnabled',p_enabled);
end $$;
create function public.hm_run_expired_cleanup(p_actor uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare unpaid jsonb;content jsonb;sender_count integer;report_count integer:=0;visit_count integer:=0;optional boolean;result jsonb;
begin
 if p_actor is not null and not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 perform pg_advisory_xact_lock(730491224);
 select optional_enabled into optional from public.hm_data_cleanup_settings where id=true;
 unpaid:=public.hm_expire_unpaid_comments();
 content:=public.hm_remove_community_content(null,true,true);
 sender_count:=public.hm_purge_sender_evidence();
 if optional then
  delete from public.hm_alex_reports where generated_at<now()-interval '30 days';get diagnostics report_count=row_count;
  delete from public.hm_alex_events where event_type='site_view' and created_at<now()-interval '30 days';get diagnostics visit_count=row_count;
 end if;
 result:=jsonb_build_object('unpaidOrders',unpaid->'ordersRemoved','unpaidComments',unpaid->'commentsRemoved','contentRemoved',content->'removed','expiredSenders',sender_count,'reports',report_count,'visits',visit_count,'optionalEnabled',optional);
 update public.hm_data_cleanup_settings set last_run_at=now(),last_result=result where id=true;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'expired_data_cleanup',result||jsonb_build_object('source',case when p_actor is null then 'automatic' else 'team' end));
 return result;
end $$;
revoke all on function public.hm_data_cleanup_status(uuid),public.hm_update_cleanup_preferences(uuid,boolean),public.hm_run_expired_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.hm_data_cleanup_status(uuid),public.hm_update_cleanup_preferences(uuid,boolean),public.hm_run_expired_cleanup(uuid) to service_role;
select cron.schedule('hocco-message-data-cleanup','13 * * * *','select public.hm_run_expired_cleanup(null);');
commit;
