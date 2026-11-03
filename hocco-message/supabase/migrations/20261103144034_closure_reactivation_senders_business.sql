begin;
alter table public.hm_sender_evidence drop constraint hm_sender_evidence_check;
alter table public.hm_sender_evidence add column confirmed_at timestamptz,add column purchase jsonb not null default '{}'::jsonb;
alter table public.hm_sender_evidence add constraint hm_sender_evidence_window check(expires_at=coalesce(confirmed_at,recorded_at)+interval '48 hours');
grant update on public.hm_sender_evidence to service_role;
create function public.hm_snapshot_sender_purchase() returns trigger language plpgsql security invoker set search_path='' as $$
declare k text; snap jsonb;
begin
 k:=case when tg_table_name='hm_orders' then 'order' else 'community' end;
 snap:=jsonb_build_object('message',new.message,'modality',case when k='order' then 'video' else to_jsonb(new)->>'destination' end,'priceCents',new.price_cents,'episode',to_jsonb(new)->>'episode','slot',to_jsonb(new)->'slot');
 update public.hm_sender_evidence set purchase=case when purchase='{}'::jsonb then snap else purchase end,
 confirmed_at=case when confirmed_at is null and new.payment='confirmed' then now() else confirmed_at end,
 expires_at=case when confirmed_at is null and new.payment='confirmed' then now()+interval '48 hours' else expires_at end
 where kind=k and code=new.code and expires_at>now();
 return new;
end $$;
revoke all on function public.hm_snapshot_sender_purchase() from public,anon,authenticated;
create trigger hm_sender_order_snapshot after insert or update of payment,review on public.hm_orders for each row execute function public.hm_snapshot_sender_purchase();
create trigger hm_sender_community_snapshot after insert or update of payment,review on public.hm_community_messages for each row execute function public.hm_snapshot_sender_purchase();
-- Preserve the original message before public content lifecycle redacts it.
update public.hm_sender_evidence e set purchase=jsonb_build_object('message',o.message,'modality','video','priceCents',o.price_cents,'episode',o.episode,'slot',o.slot) from public.hm_orders o where e.kind='order' and e.code=o.code and e.purchase='{}'::jsonb;
update public.hm_sender_evidence e set purchase=jsonb_build_object('message',o.message,'modality',o.destination,'priceCents',o.price_cents) from public.hm_community_messages o where e.kind='community' and e.code=o.code and e.purchase='{}'::jsonb;
create or replace function public.hm_list_sender_evidence(p_actor uuid,p_search text default '',p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; codes jsonb;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 with eligible as (
 select e.* from public.hm_sender_evidence e where e.expires_at>now() and e.confirmed_at is not null and (p_search='' or position(lower(left(p_search,120)) in lower(e.code||' '||e.provided_name))>0) and
 (e.kind='order' and exists(select 1 from public.hm_orders o where o.code=e.code and o.payment='confirmed' and o.review='approved' and not o.payment_hold and not o.is_demo)
 or e.kind='community' and exists(select 1 from public.hm_community_messages o where o.code=e.code and o.payment='confirmed' and o.review='approved' and not o.payment_hold))
 ), page as (select * from eligible order by confirmed_at desc,kind,code limit 50 offset greatest(p_offset,0))
 select jsonb_build_object('total',(select count(*) from eligible),'items',coalesce(jsonb_agg(jsonb_build_object('kind',kind,'code',code,'fullName',provided_name,'phone',phone,'ip',host(observed_ip),'recordedAt',recorded_at,'confirmedAt',confirmed_at,'expiresAt',expires_at,'purchase',purchase) order by confirmed_at desc,kind,code),'[]'::jsonb)),coalesce(jsonb_agg(code),'[]'::jsonb) into result,codes from page;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'sender_evidence_access',jsonb_build_object('source','automatic_paid_queue','codes',codes,'offset',greatest(p_offset,0)));
 return result;
end $$;
revoke all on function public.hm_list_sender_evidence(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.hm_list_sender_evidence(uuid,text,integer) to service_role;
create or replace function public.hm_read_sender_evidence(p_actor uuid,p_kind text,p_code text,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.hm_sender_evidence;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 select * into item from public.hm_sender_evidence where kind=p_kind and code=p_code and expires_at>now();
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'sender_evidence_access',jsonb_build_object('kind',p_kind,'code',p_code,'source','team_lookup','available',found));
 if item.code is null then return jsonb_build_object('available',false);end if;
 return jsonb_build_object('available',true,'fullName',item.provided_name,'phone',item.phone,'ip',host(item.observed_ip),'recordedAt',item.recorded_at,'expiresAt',item.expires_at,'purchase',item.purchase);
end $$;
-- Existing explicit WhatsApp subscriptions are retained, separate from the 48h evidence vault.
alter table public.hm_reminder_subscriptions drop constraint hm_reminder_subscriptions_order_id_fkey;
alter table public.hm_reminder_subscriptions add constraint hm_reminder_subscriptions_order_id_fkey foreign key(order_id) references public.hm_orders(id) on delete set null;
alter table public.hm_reminder_subscriptions add column activity_hash text unique,add column source_code text not null default '',add column origin text not null default 'video',add column last_activity_at timestamptz not null default now(),add column cycle_count integer not null default 0,add column sent_count integer not null default 0,add column return_count integer not null default 0,add column conversion_count integer not null default 0,add column last_return_at timestamptz,add column last_conversion_at timestamptz,add column last_variant text not null default '',add column dispatch_id uuid;
create table public.hm_reactivation_events(id bigint generated always as identity primary key,phone_hash text not null,event text not null check(event in ('sent','failed','returned','converted')),variant text not null default '',created_at timestamptz not null default now());
alter table public.hm_reactivation_events enable row level security;
revoke all on public.hm_reactivation_events from public,anon,authenticated;
grant select,insert,delete on public.hm_reactivation_events to service_role;
grant usage,select on sequence public.hm_reactivation_events_id_seq to service_role;
create index hm_reactivation_events_time_idx on public.hm_reactivation_events(created_at);
create function public.hm_register_reactivation(p_hash text,p_phone text,p_name text,p_kind text,p_code text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_hash !~ '^[a-f0-9]{64}$' or p_phone !~ '^55[1-9][0-9]{9,10}$' or p_kind not in ('order','community') then raise exception 'Autorização de retorno inválida.';end if;
 insert into public.hm_reminder_subscriptions(phone,name,order_id,enabled,consented_at,next_send_at,activity_hash,source_code,origin,last_activity_at)
 values(p_phone,left(p_name,120),case when p_kind='order' then (select id from public.hm_orders where code=p_code) else null end,true,now(),now()+interval '48 hours',p_hash,p_code,case when p_kind='order' then 'video' else (select destination from public.hm_community_messages where code=p_code) end,now())
 on conflict(phone) do update set activity_hash=excluded.activity_hash,source_code=excluded.source_code,origin=excluded.origin,order_id=excluded.order_id,enabled=true,consented_at=now(),unsubscribed_at=null,last_activity_at=now(),next_send_at=now()+interval '48 hours',cycle_count=0,failure_count=0,last_error='',dispatch_id=null;
end $$;
create function public.hm_reactivation_activity(p_hashes text[],p_disable boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare s public.hm_reminder_subscriptions; returning_user boolean;
begin
 if coalesce(array_length(p_hashes,1),0)>100 then raise exception 'Limite de identificadores excedido.';end if;
 for s in select * from public.hm_reminder_subscriptions where activity_hash=any(p_hashes) for update loop
  if p_disable then update public.hm_reminder_subscriptions set enabled=false,next_send_at=null,unsubscribed_at=now(),dispatch_id=null where phone=s.phone;
  else
   returning_user:=s.last_sent_at is not null and s.last_sent_at>s.last_activity_at;
   update public.hm_reminder_subscriptions set last_activity_at=now(),next_send_at=case when enabled then now()+interval '48 hours' else null end,cycle_count=0,dispatch_id=null,return_count=return_count+case when returning_user then 1 else 0 end,last_return_at=case when returning_user then now() else last_return_at end where phone=s.phone;
   if returning_user then insert into public.hm_reactivation_events(phone_hash,event) values(md5(s.phone),'returned');end if;
  end if;
 end loop;
end $$;
create function public.hm_claim_reactivation(p_limit integer default 50) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 with due as (select phone from public.hm_reminder_subscriptions where enabled and activity_hash is not null and failure_count<3 and next_send_at<=now() and last_activity_at<=now()-interval '48 hours' order by next_send_at limit least(greatest(p_limit,1),100) for update skip locked), claimed as (
 update public.hm_reminder_subscriptions s set next_send_at=now()+case when cycle_count>=3 then interval '14 days' else interval '48 hours' end,last_attempt_at=now(),dispatch_id=gen_random_uuid(),last_variant=case when cycle_count=0 and not exists(select 1 from public.hm_orders o where o.code=s.source_code and o.payment='confirmed') and not exists(select 1 from public.hm_community_messages c where c.code=s.source_code and c.payment='confirmed') then 'abandoned' when cycle_count=0 then 'participant' else least(cycle_count+1,3)::text end from due where s.phone=due.phone returning s.*)
 select coalesce(jsonb_agg(jsonb_build_object('phone',phone,'name',name,'variant',last_variant,'dispatchId',dispatch_id,'activityHash',activity_hash)),'[]'::jsonb) into result from claimed;return result;
end $$;
create function public.hm_reactivation_dispatch_valid(p_hash text,p_dispatch uuid) returns boolean language sql security invoker set search_path='' as $$ select exists(select 1 from public.hm_reminder_subscriptions where activity_hash=p_hash and dispatch_id=p_dispatch and enabled and last_activity_at<=now()-interval '48 hours') $$;
create function public.hm_finish_reactivation(p_hash text,p_dispatch uuid,p_sent boolean,p_detail jsonb default '{}') returns void language plpgsql security invoker set search_path='' as $$
declare s public.hm_reminder_subscriptions;
begin
 update public.hm_reminder_subscriptions set sent_count=sent_count+case when p_sent then 1 else 0 end,cycle_count=cycle_count+case when p_sent then 1 else 0 end,last_sent_at=case when p_sent then now() else last_sent_at end,failure_count=case when p_sent then 0 else failure_count+1 end,last_error=case when p_sent then '' else left(coalesce(p_detail->>'reason','Falha no canal'),300) end,next_send_at=now()+case when not p_sent then interval '48 hours' when cycle_count>=2 then interval '14 days' else interval '48 hours' end,dispatch_id=null where activity_hash=p_hash and dispatch_id=p_dispatch and enabled returning * into s;
 if s.phone is not null then insert into public.hm_reactivation_events(phone_hash,event,variant) values(md5(s.phone),case when p_sent then 'sent' else 'failed' end,s.last_variant);end if;
end $$;
create function public.hm_reactivation_conversion() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.hm_reminder_subscriptions;
begin
 if new.payment='confirmed' and old.payment is distinct from 'confirmed' then
 for s in update public.hm_reminder_subscriptions set conversion_count=conversion_count+1,last_conversion_at=now() where source_code=new.code and last_return_at>coalesce(last_conversion_at,'epoch'::timestamptz) and last_return_at>now()-interval '7 days' returning * loop insert into public.hm_reactivation_events(phone_hash,event) values(md5(s.phone),'converted');end loop;
 end if;return new;
end $$;
create trigger hm_reactivation_order_conversion after update of payment on public.hm_orders for each row execute function public.hm_reactivation_conversion();
create trigger hm_reactivation_community_conversion after update of payment on public.hm_community_messages for each row execute function public.hm_reactivation_conversion();
create function public.hm_reactivation_dashboard(p_actor uuid,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 select jsonb_build_object('eligible',count(*) filter(where enabled and failure_count<3 and next_send_at<=now() and last_activity_at<=now()-interval '48 hours'),'paused',count(*) filter(where not enabled or failure_count>=3),'total',count(*),'items',(select coalesce(jsonb_agg(jsonb_build_object('name',name,'origin',origin,'lastActivity',last_activity_at,'lastNotification',last_sent_at,'received',sent_count,'returns',return_count,'enabled',enabled,'failureCount',failure_count,'lastError',last_error,'nextSend',next_send_at)),'[]') from (select * from public.hm_reminder_subscriptions order by last_activity_at desc limit 50 offset greatest(p_offset,0)) page),'sentToday',(select count(*) from public.hm_reactivation_events where event='sent' and created_at>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),'returns',(select count(*) from public.hm_reactivation_events where event='returned' and created_at>now()-interval '30 days'),'conversions',(select count(*) from public.hm_reactivation_events where event='converted' and created_at>now()-interval '30 days'),'sent30',(select count(*) from public.hm_reactivation_events where event='sent' and created_at>now()-interval '30 days'),'failures',(select count(*) from public.hm_reactivation_events where event='failed' and created_at>now()-interval '30 days')) into result from public.hm_reminder_subscriptions;return result;
end $$;
-- Disable the obsolete unsegmented sender; the same hourly Edge cron runs the new claims.
create or replace function public.hm_claim_due_reminders(p_limit integer default 50) returns table(phone text,name text,order_id uuid) language plpgsql security invoker set search_path='' as $$ begin return;end $$;
revoke all on function public.hm_register_reactivation(text,text,text,text,text),public.hm_reactivation_activity(text[],boolean),public.hm_claim_reactivation(integer),public.hm_reactivation_dispatch_valid(text,uuid),public.hm_finish_reactivation(text,uuid,boolean,jsonb),public.hm_reactivation_conversion(),public.hm_reactivation_dashboard(uuid,integer) from public,anon,authenticated;
grant execute on function public.hm_register_reactivation(text,text,text,text,text),public.hm_reactivation_activity(text[],boolean),public.hm_claim_reactivation(integer),public.hm_reactivation_dispatch_valid(text,uuid),public.hm_finish_reactivation(text,uuid,boolean,jsonb),public.hm_reactivation_dashboard(uuid,integer) to service_role;
select cron.schedule('hocco-reactivation-retention','17 4 * * *',$job$delete from public.hm_reactivation_events where created_at<now()-interval '90 days'; delete from public.hm_reminder_subscriptions where last_activity_at<now()-interval '90 days';$job$);

create function public.hm_prepare_sponsor_activation() returns trigger language plpgsql security invoker set search_path='' as $$
declare base timestamptz;
begin
 if new.review='approved' and new.payment='confirmed' and not new.payment_hold and new.archived_at is null and new.starts_at is null then
  base:=now();
  if new.renewal_of is not null then select greatest(base,coalesce(expires_at,base)) into base from public.hm_sponsors where id=new.renewal_of;end if;
  new.starts_at:=coalesce(base,now());new.expires_at:=new.starts_at+interval '7 days';
  new.next_thank_at:=case when new.thank_you_opt_in then new.starts_at+interval '2 days' else null end;
  new.next_expiry_notice_at:=case when new.expiry_notice_opt_in then new.expires_at-interval '1 day' else null end;
  new.notification_status:=case when new.thank_you_opt_in or new.expiry_notice_opt_in then 'pending' else 'not_configured' end;
 end if;return new;
end $$;
revoke all on function public.hm_prepare_sponsor_activation() from public,anon,authenticated;
create trigger hm_a_prepare_sponsor_activation before update of payment,review,payment_hold on public.hm_sponsors for each row execute function public.hm_prepare_sponsor_activation();
-- Recover the first payment confirmation only where it is recorded; never invent old identity fields.
update public.hm_sender_evidence e set confirmed_at=a.stamp,expires_at=a.stamp+interval '48 hours' from (select 'order'::text kind,o.code,min(h.created_at) stamp from public.hm_orders o join public.hm_audit h on h.order_id=o.id and h.action='pay' where o.payment='confirmed' group by o.code union all select 'community',c.code,min(h.created_at) from public.hm_community_messages c join public.hm_community_audit h on h.post_id=c.id and h.action in ('payment_confirmed','pay') where c.payment='confirmed' group by c.code) a where e.kind=a.kind and e.code=a.code and e.confirmed_at is null and e.expires_at>now() and a.stamp+interval '48 hours'>now();
commit;
