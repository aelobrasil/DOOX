begin;
-- Re-engagement is performed by the installed web app, never by telephone.
update public.hm_reminder_subscriptions set enabled=false,next_send_at=null,dispatch_id=null where activity_hash is not null;
create table public.hm_push_devices(
 device_hash text primary key check(device_hash ~ '^[a-f0-9]{64}$'),
 endpoint text unique not null,p256dh text not null,auth_key text not null,vapid_version smallint not null,
 enabled boolean not null default true,display_name text not null default 'Visitante',origin text not null default 'visitor',source_code text not null default '',source_kind text not null default '',
 consented_at timestamptz not null default now(),last_activity_at timestamptz not null default now(),next_send_at timestamptz default now()+interval '48 hours',
 cycle_count integer not null default 0,sent_count integer not null default 0,failure_count integer not null default 0,return_count integer not null default 0,conversion_count integer not null default 0,
 last_sent_at timestamptz,last_return_at timestamptz,last_conversion_at timestamptz,last_error text not null default '',dispatch_id uuid,last_variant text not null default '',unsubscribed_at timestamptz
);
alter table public.hm_push_devices enable row level security;
revoke all on public.hm_push_devices from public,anon,authenticated;
grant select,insert,update,delete on public.hm_push_devices to service_role;
create index hm_push_devices_due_idx on public.hm_push_devices(next_send_at) where enabled;
create table public.hm_push_inbox(
 id uuid primary key default gen_random_uuid(),device_hash text not null references public.hm_push_devices(device_hash) on delete cascade,
 variant text not null,title text not null,body text not null,created_at timestamptz not null default now(),sent_at timestamptz,read_at timestamptz,clicked_at timestamptz,
 status text not null default 'created' check(status in ('created','sent','failed')),dispatch_id uuid not null unique
);
alter table public.hm_push_inbox enable row level security;
revoke all on public.hm_push_inbox from public,anon,authenticated;
grant select,insert,update,delete on public.hm_push_inbox to service_role;
create index hm_push_inbox_device_time_idx on public.hm_push_inbox(device_hash,created_at desc);
create function public.hm_push_register(p_hash text,p_subscription jsonb,p_version smallint) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.hocco_push_config where id=true and enabled and vapid_version=p_version) then raise exception 'Configuração de notificações mudou. Tente ativar novamente.';end if;
 insert into public.hm_push_devices(device_hash,endpoint,p256dh,auth_key,vapid_version)
 values(p_hash,p_subscription->>'endpoint',p_subscription#>>'{keys,p256dh}',p_subscription#>>'{keys,auth}',p_version)
 on conflict(device_hash) do update set endpoint=excluded.endpoint,p256dh=excluded.p256dh,auth_key=excluded.auth_key,vapid_version=excluded.vapid_version,enabled=true,consented_at=now(),last_activity_at=now(),next_send_at=now()+interval '48 hours',cycle_count=0,failure_count=0,last_error='',dispatch_id=null,unsubscribed_at=null;
end $$;
create function public.hm_push_activity(p_hash text,p_composing boolean default false,p_disable boolean default false,p_notification uuid default null) returns void language plpgsql security invoker set search_path='' as $$
declare d public.hm_push_devices;returned boolean;
begin
 select * into d from public.hm_push_devices where device_hash=p_hash for update;if not found then return;end if;
 if p_disable then update public.hm_push_devices set enabled=false,next_send_at=null,dispatch_id=null,unsubscribed_at=now() where device_hash=p_hash;return;end if;
 returned:=d.last_sent_at is not null and d.last_sent_at>d.last_activity_at;
 update public.hm_push_devices set last_activity_at=now(),cycle_count=0,dispatch_id=null,next_send_at=case when enabled and failure_count<3 then now()+interval '48 hours' else null end,return_count=return_count+case when returned then 1 else 0 end,last_return_at=case when returned then now() else last_return_at end,origin=case when p_composing and source_code='' then 'abandoned' else origin end where device_hash=p_hash;
 if returned then insert into public.hm_reactivation_events(phone_hash,event,variant) values(p_hash,'returned','push');end if;
 if p_notification is not null then update public.hm_push_inbox set read_at=coalesce(read_at,now()),clicked_at=coalesce(clicked_at,now()) where id=p_notification and device_hash=p_hash;end if;
end $$;
create function public.hm_push_bind_purchase(p_hash text,p_kind text,p_code text) returns void language plpgsql security invoker set search_path='' as $$
declare n text;
begin
 if p_kind='order' then select name into n from public.hm_orders where code=p_code;
 elsif p_kind='community' then select member_name into n from public.hm_community_messages where code=p_code;
 else raise exception 'Tipo inválido.';end if;
 if n is null then return;end if;
 update public.hm_push_devices set display_name=left(n,120),source_kind=p_kind,source_code=p_code,origin='abandoned',last_activity_at=now(),cycle_count=0,dispatch_id=null,next_send_at=case when enabled then now()+interval '48 hours' else null end where device_hash=p_hash;
end $$;
create function public.hm_push_claim(p_limit integer default 50) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.hm_push_devices;v text;txt text;message_id uuid;results jsonb:='[]';
begin
 for d in select s.* from public.hm_push_devices s join public.hocco_push_config c on c.id=true and c.enabled and c.vapid_version=s.vapid_version where s.enabled and s.failure_count<3 and s.next_send_at<=now() and s.last_activity_at<=now()-interval '48 hours' order by s.next_send_at limit least(greatest(p_limit,1),50) for update of s skip locked loop
 v:=case when d.cycle_count>0 then least(d.cycle_count+1,3)::text when exists(select 1 from public.hm_orders where code=d.source_code and payment='confirmed') or exists(select 1 from public.hm_community_messages where code=d.source_code and payment='confirmed') then 'participant' when d.origin='abandoned' then 'abandoned' else '1' end;
 txt:=case v when '1' then 'O HOCCO continua acontecendo. Volte ao Reality e acompanhe a experiência oficial.' when '2' then 'Você ainda pode participar do HOCCO. Entre novamente, acompanhe o Reality e envie sua participação.' when '3' then 'O HOCCO continua. Entre novamente e acompanhe o Reality.' when 'participant' then 'Você já participou do HOCCO. Entre novamente e acompanhe as próximas participações.' else 'Você começou sua participação no HOCCO. Volte para acompanhar ou iniciar um novo envio se o prazo de pagamento terminou.' end;
 d.dispatch_id:=gen_random_uuid();
 update public.hm_push_devices set dispatch_id=d.dispatch_id,last_variant=v,next_send_at=now()+interval '48 hours' where device_hash=d.device_hash;
 insert into public.hm_push_inbox(device_hash,variant,title,body,dispatch_id) values(d.device_hash,v,'HOCCO Reality',txt,d.dispatch_id) returning id into message_id;
 results:=results||jsonb_build_array(jsonb_build_object('deviceHash',d.device_hash,'endpoint',d.endpoint,'keys',jsonb_build_object('p256dh',d.p256dh,'auth',d.auth_key),'dispatchId',d.dispatch_id,'notificationId',message_id,'title','HOCCO Reality','body',txt,'variant',v));
 end loop;return results;
end $$;
create function public.hm_push_dispatch_valid(p_hash text,p_dispatch uuid) returns boolean language sql security invoker set search_path='' as $$ select exists(select 1 from public.hm_push_devices where device_hash=p_hash and dispatch_id=p_dispatch and enabled and failure_count<3 and last_activity_at<=now()-interval '48 hours') $$;
create function public.hm_push_finish(p_hash text,p_dispatch uuid,p_sent boolean,p_gone boolean default false,p_error text default '') returns void language plpgsql security invoker set search_path='' as $$
declare d public.hm_push_devices;
begin
 update public.hm_push_devices set sent_count=sent_count+case when p_sent then 1 else 0 end,cycle_count=cycle_count+case when p_sent then 1 else 0 end,last_sent_at=case when p_sent then now() else last_sent_at end,failure_count=case when p_sent then 0 else failure_count+1 end,last_error=case when p_sent then '' else left(p_error,300) end,enabled=case when p_gone then false else enabled end,next_send_at=case when p_gone or not p_sent and failure_count>=2 then null when p_sent and cycle_count>=2 then now()+interval '14 days' else now()+interval '48 hours' end,dispatch_id=null where device_hash=p_hash and dispatch_id=p_dispatch returning * into d;
 if d.device_hash is not null then update public.hm_push_inbox set status=case when p_sent then 'sent' else 'failed' end,sent_at=case when p_sent then now() else null end where dispatch_id=p_dispatch;
 insert into public.hm_reactivation_events(phone_hash,event,variant) values(p_hash,case when p_sent then 'sent' else 'failed' end,'push');end if;
end $$;
create function public.hm_push_read(p_hash text,p_id uuid) returns void language sql security invoker set search_path='' as $$ update public.hm_push_inbox set read_at=coalesce(read_at,now()) where id=p_id and device_hash=p_hash $$;
create function public.hm_push_conversion() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.hm_push_devices;
begin
 if new.payment='confirmed' and old.payment is distinct from 'confirmed' then
 for d in update public.hm_push_devices set origin='participant',conversion_count=conversion_count+case when last_return_at>coalesce(last_conversion_at,'epoch'::timestamptz) and last_return_at>now()-interval '7 days' then 1 else 0 end,last_conversion_at=case when last_return_at>coalesce(last_conversion_at,'epoch'::timestamptz) and last_return_at>now()-interval '7 days' then now() else last_conversion_at end where source_code=new.code returning * loop
 if d.last_conversion_at=now() then insert into public.hm_reactivation_events(phone_hash,event,variant) values(d.device_hash,'converted','push');end if;end loop;
 end if;return new;
end $$;
create trigger hm_push_order_conversion after update of payment on public.hm_orders for each row execute function public.hm_push_conversion();
create trigger hm_push_community_conversion after update of payment on public.hm_community_messages for each row execute function public.hm_push_conversion();
create function public.hm_push_dashboard(p_actor uuid,p_offset integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 select jsonb_build_object('eligible',count(*) filter(where enabled and failure_count<3 and next_send_at<=now() and last_activity_at<=now()-interval '48 hours'),'paused',count(*) filter(where not enabled or failure_count>=3),'total',count(*),'items',(select coalesce(jsonb_agg(jsonb_build_object('name',display_name,'origin',origin,'lastActivity',last_activity_at,'lastNotification',last_sent_at,'received',sent_count,'returns',return_count,'enabled',enabled,'failureCount',failure_count,'lastError',last_error,'nextSend',next_send_at)),'[]') from (select * from public.hm_push_devices order by last_activity_at desc limit 50 offset greatest(p_offset,0)) page),'sentToday',(select count(*) from public.hm_reactivation_events where variant='push' and event='sent' and created_at>=date_trunc('day',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'),'returns',(select count(*) from public.hm_reactivation_events where variant='push' and event='returned' and created_at>now()-interval '30 days'),'conversions',(select count(*) from public.hm_reactivation_events where variant='push' and event='converted' and created_at>now()-interval '30 days'),'sent30',(select count(*) from public.hm_reactivation_events where variant='push' and event='sent' and created_at>now()-interval '30 days'),'failures',(select count(*) from public.hm_reactivation_events where variant='push' and event='failed' and created_at>now()-interval '30 days')) into result from public.hm_push_devices;return result;
end $$;
revoke all on function public.hm_push_register(text,jsonb,smallint),public.hm_push_activity(text,boolean,boolean,uuid),public.hm_push_bind_purchase(text,text,text),public.hm_push_claim(integer),public.hm_push_dispatch_valid(text,uuid),public.hm_push_finish(text,uuid,boolean,boolean,text),public.hm_push_read(text,uuid),public.hm_push_conversion(),public.hm_push_dashboard(uuid,integer) from public,anon,authenticated;
grant execute on function public.hm_push_register(text,jsonb,smallint),public.hm_push_activity(text,boolean,boolean,uuid),public.hm_push_bind_purchase(text,text,text),public.hm_push_claim(integer),public.hm_push_dispatch_valid(text,uuid),public.hm_push_finish(text,uuid,boolean,boolean,text),public.hm_push_read(text,uuid),public.hm_push_dashboard(uuid,integer) to service_role;
select cron.schedule('hocco-message-push','*/5 * * * *',$job$select net.http_post(url:='https://vebqvedmhfaebvdantiu.supabase.co/functions/v1/hocco-message',headers:=jsonb_build_object('Content-Type','application/json','x-hocco-cron',(select decrypted_secret from vault.decrypted_secrets where name='hocco_push_cron_secret' limit 1)),body:='{"action":"push.run"}'::jsonb,timeout_milliseconds:=60000);$job$);
select cron.schedule('hocco-message-push-retention','27 4 * * *',$job$delete from public.hm_push_inbox where created_at<now()-interval '90 days';delete from public.hm_push_devices where last_activity_at<now()-interval '90 days';$job$);
commit;
