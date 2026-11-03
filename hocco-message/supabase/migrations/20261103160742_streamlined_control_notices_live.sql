begin;
alter table public.hm_programming add column next_live_url text not null default '' check(length(next_live_url)<=500 and (next_live_url='' or next_live_url ~ '^https://(www\.|m\.)?(youtube\.com|youtu\.be|tiktok\.com)/'));
create or replace function public.hm_update_programming(p_actor uuid,p_payload jsonb) returns public.hm_programming language plpgsql security invoker set search_path='' as $$
declare old public.hm_programming;saved public.hm_programming;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 select * into old from public.hm_programming where id=1 for update;
 update public.hm_programming set topic=p_payload->>'topic',next_live_title=p_payload->>'liveTitle',next_live_at=nullif(p_payload->>'liveAt','')::timestamptz,live_capacity=50,live_accepting=(p_payload->>'accepting')::boolean,next_live_url=case when p_payload?'liveUrl' then coalesce(p_payload->>'liveUrl','') else old.next_live_url end,updated_at=now() where id=1 returning * into saved;
 if saved.live_accepting and ((saved.next_live_at is not null and saved.next_live_at<=now()) or char_length(saved.next_live_title)<2) then raise exception 'Defina um título e, se informar uma data, escolha um horário futuro.';end if;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'programming_update',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));return saved;
end $$;
create function public.hm_update_content_controls(p_actor uuid,p_title text,p_url text,p_programming jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.hm_programming;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 perform public.hm_set_featured_episode(p_actor,p_title,p_url);
 p:=public.hm_update_programming(p_actor,p_programming);
 return jsonb_build_object('ok',true,'programming',to_jsonb(p));
end $$;
create table public.hm_notice_campaigns(id uuid primary key default gen_random_uuid(),request_key uuid not null unique,actor_id uuid not null,title text not null check(length(title) between 3 and 80),body text not null check(length(body) between 5 and 240),url text not null check(url in ('/#inicio','/#assistir','/#episodios','/#comunidade','/#live','/#enviar','/ir-alem/')),audience text not null check(audience in ('all','participants','inactive')),status text not null default 'queued' check(status in ('queued','completed','cancelled')),target_count integer not null default 0,created_at timestamptz not null default now(),cancelled_at timestamptz);
alter table public.hm_notice_campaigns enable row level security;
revoke all on public.hm_notice_campaigns from public,anon,authenticated;
grant select,insert,update,delete on public.hm_notice_campaigns to service_role;
create table public.hm_notice_deliveries(campaign_id uuid not null references public.hm_notice_campaigns(id) on delete cascade,device_hash text not null references public.hm_push_devices(device_hash) on delete cascade,notification_id uuid not null default gen_random_uuid(),status text not null default 'pending' check(status in ('pending','claimed','sent','failed','skipped')),dispatch_id uuid,claimed_at timestamptz,error text not null default '',primary key(campaign_id,device_hash));
alter table public.hm_notice_deliveries enable row level security;
revoke all on public.hm_notice_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.hm_notice_deliveries to service_role;
create index hm_notice_pending_idx on public.hm_notice_deliveries(campaign_id,status);
alter table public.hm_push_inbox add column url text not null default '/#inicio',add column campaign_id uuid references public.hm_notice_campaigns(id) on delete cascade;
create function public.hm_notice_recipient(d public.hm_push_devices,p_audience text) returns boolean language sql stable security invoker set search_path='' as $$
 select d.enabled and d.failure_count<3 and exists(select 1 from public.hocco_push_config c where c.id=true and c.enabled and c.vapid_version=d.vapid_version) and (p_audience='all' or p_audience='inactive' and d.last_activity_at<=now()-interval '48 hours' or p_audience='participants' and (exists(select 1 from public.hm_orders o where o.code=d.source_code and o.payment='confirmed') or exists(select 1 from public.hm_community_messages m where m.code=d.source_code and m.payment='confirmed')))
$$;
create function public.hm_notice_preview(p_actor uuid,p_audience text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 if p_audience not in ('all','participants','inactive') then raise exception 'Público inválido.';end if;
 return jsonb_build_object('recipients',(select count(*) from public.hm_push_devices d where public.hm_notice_recipient(d,p_audience)),'channel','push');
end $$;
create function public.hm_notice_enqueue(p_actor uuid,p_key uuid,p_payload jsonb,p_expected integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.hm_notice_campaigns;n integer;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 perform pg_advisory_xact_lock(hashtextextended('hm-notice:'||p_key::text,0));
 select * into c from public.hm_notice_campaigns where request_key=p_key;
 if found then
  if c.actor_id<>p_actor or c.title is distinct from p_payload->>'title' or c.body is distinct from p_payload->>'body' or c.url is distinct from p_payload->>'url' or c.audience is distinct from p_payload->>'audience' then raise exception 'A confirmação deste aviso não corresponde ao conteúdo enviado.';end if;
  return jsonb_build_object('campaignId',c.id,'targetCount',c.target_count,'duplicate',true);
 end if;
 select count(*) into n from public.hm_push_devices d where public.hm_notice_recipient(d,p_payload->>'audience');
 if n=0 then raise exception 'Não há aparelhos autorizados neste público.';end if;
 if n is distinct from p_expected then raise exception 'O público mudou. Confira a prévia novamente antes de confirmar.';end if;
 insert into public.hm_notice_campaigns(request_key,actor_id,title,body,url,audience,target_count) values(p_key,p_actor,p_payload->>'title',p_payload->>'body',p_payload->>'url',p_payload->>'audience',n) returning * into c;
 insert into public.hm_notice_deliveries(campaign_id,device_hash) select c.id,d.device_hash from public.hm_push_devices d where public.hm_notice_recipient(d,c.audience);
 update public.hm_notice_campaigns set target_count=(select count(*) from public.hm_notice_deliveries where campaign_id=c.id) where id=c.id returning * into c;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'manual_notice_queued',jsonb_build_object('campaign',c.id,'targetCount',c.target_count,'audience',c.audience));
 return jsonb_build_object('campaignId',c.id,'targetCount',c.target_count,'duplicate',false);
end $$;
create function public.hm_notice_claim(p_limit integer default 50) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record;dispatch uuid;results jsonb:='[]';
begin
 -- A crashed worker is not automatically retried: avoid duplicate manual announcements.
 update public.hm_notice_deliveries set status='failed',error='Envio interrompido; entrega não confirmada.' where status='claimed' and claimed_at<now()-interval '10 minutes';
 for r in select t.*,c.title,c.body,c.url,d.endpoint,d.p256dh,d.auth_key,c.audience from public.hm_notice_deliveries t join public.hm_notice_campaigns c on c.id=t.campaign_id join public.hm_push_devices d on d.device_hash=t.device_hash where t.status='pending' and c.status='queued' order by c.created_at,t.device_hash limit least(greatest(p_limit,1),50) for update of t skip locked loop
  if not exists(select 1 from public.hm_push_devices d where d.device_hash=r.device_hash and public.hm_notice_recipient(d,r.audience)) then update public.hm_notice_deliveries set status='skipped' where campaign_id=r.campaign_id and device_hash=r.device_hash;continue;end if;
  dispatch:=gen_random_uuid();update public.hm_notice_deliveries set status='claimed',dispatch_id=dispatch,claimed_at=now() where campaign_id=r.campaign_id and device_hash=r.device_hash;
  insert into public.hm_push_inbox(id,device_hash,variant,title,body,dispatch_id,url,campaign_id) values(r.notification_id,r.device_hash,'manual',r.title,r.body,dispatch,r.url,r.campaign_id);
  results:=results||jsonb_build_array(jsonb_build_object('deviceHash',r.device_hash,'dispatchId',dispatch,'notificationId',r.notification_id,'campaignId',r.campaign_id,'endpoint',r.endpoint,'keys',jsonb_build_object('p256dh',r.p256dh,'auth',r.auth_key),'title',r.title,'body',r.body,'url',r.url));
 end loop;
 update public.hm_notice_campaigns c set status='completed' where c.status='queued' and not exists(select 1 from public.hm_notice_deliveries t where t.campaign_id=c.id and t.status in ('pending','claimed'));
 return results;
end $$;
create function public.hm_notice_dispatch_valid(p_hash text,p_dispatch uuid) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from public.hm_notice_deliveries t join public.hm_notice_campaigns c on c.id=t.campaign_id join public.hm_push_devices d on d.device_hash=t.device_hash where t.device_hash=p_hash and t.dispatch_id=p_dispatch and t.status='claimed' and c.status='queued' and public.hm_notice_recipient(d,c.audience))
$$;
create function public.hm_notice_finish(p_hash text,p_dispatch uuid,p_sent boolean,p_gone boolean default false,p_error text default '') returns void language plpgsql security invoker set search_path='' as $$
declare c_id uuid;
begin
 update public.hm_notice_deliveries set status=case when p_sent then 'sent' else 'failed' end,error=case when p_sent then '' else left(p_error,300) end where device_hash=p_hash and dispatch_id=p_dispatch and status='claimed' returning campaign_id into c_id;
 if c_id is null then return;end if;
 update public.hm_push_inbox set status=case when p_sent then 'sent' else 'failed' end,sent_at=case when p_sent then now() else null end where dispatch_id=p_dispatch;
 update public.hm_push_devices set enabled=case when p_gone then false else enabled end,failure_count=case when p_sent then 0 else failure_count+1 end,last_error=case when p_sent then '' else left(p_error,300) end,last_sent_at=case when p_sent then now() else last_sent_at end,sent_count=sent_count+case when p_sent then 1 else 0 end,next_send_at=case when p_gone or not p_sent and failure_count>=2 then null when p_sent then greatest(coalesce(next_send_at,now()),now()+interval '48 hours') else next_send_at end,dispatch_id=case when p_sent then null else dispatch_id end where device_hash=p_hash;
 insert into public.hm_reactivation_events(phone_hash,event,variant) values(p_hash,case when p_sent then 'sent' else 'failed' end,'push');
 update public.hm_notice_campaigns c set status='completed' where c.id=c_id and c.status='queued' and not exists(select 1 from public.hm_notice_deliveries t where t.campaign_id=c.id and t.status in ('pending','claimed'));
end $$;
create function public.hm_notice_skip(p_hash text,p_dispatch uuid) returns void language plpgsql security invoker set search_path='' as $$
declare c_id uuid;
begin
 update public.hm_notice_deliveries set status='skipped' where device_hash=p_hash and dispatch_id=p_dispatch and status='claimed' returning campaign_id into c_id;
 delete from public.hm_push_inbox where dispatch_id=p_dispatch and status='created';
 update public.hm_notice_campaigns c set status='completed' where c.id=c_id and c.status='queued' and not exists(select 1 from public.hm_notice_deliveries t where t.campaign_id=c.id and t.status in ('pending','claimed'));
end $$;
create function public.hm_notice_cancel(p_actor uuid,p_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 update public.hm_notice_campaigns set status='cancelled',cancelled_at=now() where id=p_id and status='queued';
 update public.hm_notice_deliveries set status='skipped' where campaign_id=p_id and status in ('pending','claimed');
 delete from public.hm_push_inbox where campaign_id=p_id and status='created';
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'manual_notice_cancelled',jsonb_build_object('campaign',p_id));return jsonb_build_object('ok',true);
end $$;
create function public.hm_notice_history(p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select c.id,c.title,c.body,c.url,c.audience,c.status,c.target_count,c.created_at,count(t.device_hash) filter(where t.status='sent') sent,count(t.device_hash) filter(where t.status='failed') failed,greatest(c.target_count-count(t.device_hash) filter(where t.status in ('sent','failed','pending','claimed')),count(t.device_hash) filter(where t.status='skipped')) skipped,count(t.device_hash) filter(where t.status in ('pending','claimed')) pending from public.hm_notice_campaigns c left join public.hm_notice_deliveries t on t.campaign_id=c.id group by c.id order by c.created_at desc limit 50)x);
end $$;
revoke all on function public.hm_update_content_controls(uuid,text,text,jsonb),public.hm_notice_recipient(public.hm_push_devices,text),public.hm_notice_preview(uuid,text),public.hm_notice_enqueue(uuid,uuid,jsonb,integer),public.hm_notice_claim(integer),public.hm_notice_dispatch_valid(text,uuid),public.hm_notice_finish(text,uuid,boolean,boolean,text),public.hm_notice_cancel(uuid,uuid),public.hm_notice_skip(text,uuid),public.hm_notice_history(uuid) from public,anon,authenticated;
grant execute on function public.hm_update_content_controls(uuid,text,text,jsonb),public.hm_notice_recipient(public.hm_push_devices,text),public.hm_notice_preview(uuid,text),public.hm_notice_enqueue(uuid,uuid,jsonb,integer),public.hm_notice_claim(integer),public.hm_notice_dispatch_valid(text,uuid),public.hm_notice_finish(text,uuid,boolean,boolean,text),public.hm_notice_cancel(uuid,uuid),public.hm_notice_skip(text,uuid),public.hm_notice_history(uuid) to service_role;
select cron.schedule('hocco-message-notice-retention','37 4 * * *',$job$delete from public.hm_notice_campaigns where created_at<now()-interval '90 days' and status<>'queued';$job$);
commit;
