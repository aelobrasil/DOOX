begin;
CREATE OR REPLACE FUNCTION public.hm_create_order(p_code text, p_tracking_hash text, p_name text, p_message text, p_phone text, p_opt_in boolean, p_reminder_opt_in boolean, p_social_platform text, p_social_handle text, p_slot integer, p_legal_version text, p_expected_price integer, p_settings_version integer)
 RETURNS hm_orders
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_settings; o public.hm_orders;
begin
  perform public.hm_expire_unpaid_comments();
  if exists(select 1 from public.hm_expired_purchases where kind='order' and tracking_hash=p_tracking_hash) then raise exception 'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem.';end if;
  if p_legal_version is null or p_legal_version not in ('2026-10-31.v12','2026-11-03.v13') then raise exception 'Atualize os documentos e aceite novamente.'; end if;
  if p_slot not between 1 and 2 then raise exception 'Posição inválida.'; end if;
  if p_social_platform not in ('instagram','tiktok') or p_social_handle !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Perfil social inválido.'; end if;
  if (p_opt_in or p_reminder_opt_in) and p_phone !~ '^(55)?[1-9][0-9]{9,10}$' then raise exception 'WhatsApp inválido.'; end if;
  select * into cfg from public.hm_settings where id=1 for update;
  if cfg.video_enabled=false or cfg.demo_mode or cfg.pix_key='' or cfg.payee_name='' or cfg.payee_city='' or cfg.publication_deadline is null or cfg.publication_deadline<=now() or cfg.display_duration_seconds is null then
    raise exception 'O envio de pedidos está temporariamente indisponível.';
  end if;
  select * into o from public.hm_orders where tracking_hash=p_tracking_hash;
  if found then return o; end if;
  if p_expected_price is distinct from (cfg.prices->>(p_slot-1))::integer or p_settings_version is distinct from cfg.version then
    raise exception 'Os preços ou a oferta mudaram. Confira o valor atualizado antes de continuar.';
  end if;
  insert into public.hm_orders(code,tracking_hash,name,message,social_platform,social_handle,phone,whatsapp_opt_in,reminder_opt_in,slot,price_cents,episode,publication_deadline,display_duration_seconds,acceptance,is_demo)
  values(p_code,p_tracking_hash,p_name,p_message,p_social_platform,p_social_handle,case when p_opt_in or p_reminder_opt_in then p_phone else '' end,p_opt_in,p_reminder_opt_in,p_slot,(cfg.prices->>(p_slot-1))::integer,cfg.episode,cfg.publication_deadline,cfg.display_duration_seconds,
    jsonb_build_object('version',p_legal_version,'acceptedAt',now(),'adultDeclared',true,'publicationAuthorized',true,'privacyNoticeRead',true,'whatsappOptIn',p_opt_in,'reminderOptIn',p_reminder_opt_in,'socialPlatform',p_social_platform),false)
  returning * into o;
  if p_reminder_opt_in then
    insert into public.hm_reminder_subscriptions(phone,name,order_id,enabled,consented_at,next_send_at)
    values(p_phone,p_name,o.id,true,now(),now()+interval '2 days')
    on conflict(phone) do update set name=excluded.name,order_id=excluded.order_id,enabled=true,consented_at=now(),next_send_at=now()+interval '2 days',last_error='',unsubscribed_at=null,updated_at=now();
  end if;
  insert into public.hm_audit(order_id,action,detail) values(o.id,'created',jsonb_build_object('price',o.price_cents,'slot',o.slot,'settingsVersion',cfg.version,'legalVersion',p_legal_version));
  return o;
end; $function$;
CREATE OR REPLACE FUNCTION public.hm_create_community_purchase(p_data jsonb)
 RETURNS hm_community_messages
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_settings; result public.hm_community_messages; price integer;
begin
 perform public.hm_expire_unpaid_comments();
 perform pg_advisory_xact_lock(hashtextextended('hm-community:'||(p_data->>'tracking_hash'),0));
 if exists(select 1 from public.hm_expired_purchases where kind='community' and tracking_hash=p_data->>'tracking_hash') then raise exception 'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem.';end if;
 if (p_data->>'legal_version' is null or p_data->>'legal_version' not in ('2026-10-31.v12','2026-11-03.v13')) or p_data->>'terms' is distinct from 'true' then raise exception 'Confirme os termos e a autorização.';end if;
 if p_data->>'destination' not in ('community','live') then raise exception 'Destino inválido.';end if;
 select * into result from public.hm_community_messages where tracking_hash=p_data->>'tracking_hash';if found then return result;end if;
 select * into cfg from public.hm_settings where id=1 for update;
 price:=case when p_data->>'destination'='live' then cfg.live_price_cents else cfg.community_price_cents end;
 if (p_data->>'expected_price')::integer is distinct from price then raise exception 'O preço mudou. Abra novamente o envio para conferir o valor antes de continuar.';end if;
 if coalesce((p_data->>'requires_review')::boolean,false) then result:=public.hm_create_community_message_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::smallint,p_data->>'message',p_data->>'destination');
 else result:=public.hm_create_community_message_auto_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::smallint,p_data->>'message',p_data->>'destination');end if;
 if result.destination='live' and result.live_scheduled_at is distinct from (p_data->>'live_scheduled_at')::timestamptz then raise exception 'A programação mudou. Confira a próxima LIVE antes de continuar.';end if;
 update public.hm_community_messages set acceptance=jsonb_build_object('version',p_data->>'legal_version','acceptedAt',now(),'terms',true,'adultDeclared',true,'publicationAuthorized',true,'priceCents',price) where id=result.id returning * into result;
 return result;
end $function$;
create table public.hm_sender_evidence(
 kind text not null check(kind in ('order','community')),code text not null,
 provided_name text not null check(char_length(provided_name) between 3 and 120),
 phone text not null check(phone ~ '^55[1-9][0-9]{9,10}$'),observed_ip inet not null,
 recorded_at timestamptz not null,expires_at timestamptz not null,notice_version text not null,
 primary key(kind,code),check(expires_at=recorded_at+interval '48 hours')
);
alter table public.hm_sender_evidence enable row level security;
revoke all on public.hm_sender_evidence from public,anon,authenticated;
grant select,insert,delete on public.hm_sender_evidence to service_role;
create index hm_sender_evidence_expiry_idx on public.hm_sender_evidence(expires_at);
create or replace function public.hm_create_identified_message(p_kind text,p_data jsonb,p_identity jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.hm_orders;m public.hm_community_messages;result jsonb;stamp timestamptz;actual_code text;
begin
 if p_data->>'legal_version' is distinct from '2026-11-03.v13' then raise exception 'Atualize o app e leia o aviso de privacidade antes de continuar.';end if;
 if char_length(trim(p_identity->>'fullName')) not between 3 and 120 or (p_identity->>'phone') !~ '^55[1-9][0-9]{9,10}$' or p_identity->>'ip' is null then raise exception 'Dados privados do remetente incompletos.';end if;
 if p_kind='community' then
  m:=public.hm_create_community_purchase(p_data);result:=to_jsonb(m);stamp:=m.created_at;actual_code:=m.code;
 elsif p_kind='order' then
  o:=public.hm_create_order(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'message',coalesce(p_data->>'phone',''),coalesce((p_data->>'opt_in')::boolean,false),coalesce((p_data->>'reminder_opt_in')::boolean,false),p_data->>'social_platform',p_data->>'social_handle',(p_data->>'slot')::integer,p_data->>'legal_version',(p_data->>'expected_price')::integer,(p_data->>'settings_version')::integer);
  result:=to_jsonb(o);stamp:=o.created_at;actual_code:=o.code;
 else raise exception 'Tipo de mensagem inválido.';end if;
 if stamp+interval '48 hours'>now() then
  insert into public.hm_sender_evidence(kind,code,provided_name,phone,observed_ip,recorded_at,expires_at,notice_version)
  values(p_kind,actual_code,trim(p_identity->>'fullName'),p_identity->>'phone',(p_identity->>'ip')::inet,stamp,stamp+interval '48 hours',p_data->>'legal_version') on conflict(kind,code) do nothing;
 end if;
 return result;
end $$;
revoke all on function public.hm_create_identified_message(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_identified_message(text,jsonb,jsonb) to service_role;
create or replace function public.hm_purge_sender_evidence() returns integer language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin delete from public.hm_sender_evidence where expires_at<=now();get diagnostics removed=row_count;return removed;end $$;
revoke all on function public.hm_purge_sender_evidence() from public,anon,authenticated;
grant execute on function public.hm_purge_sender_evidence() to service_role;
create or replace function public.hm_read_sender_evidence(p_actor uuid,p_kind text,p_code text,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item public.hm_sender_evidence;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 if char_length(trim(p_reason)) not between 10 and 500 then raise exception 'Registre a finalidade da consulta (10 a 500 caracteres).';end if;
 select * into item from public.hm_sender_evidence where kind=p_kind and code=p_code and expires_at>now();
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'sender_evidence_access',jsonb_build_object('kind',p_kind,'code',p_code,'reason',trim(p_reason),'available',found));
 if item.code is null then return jsonb_build_object('available',false);end if;
 return jsonb_build_object('available',true,'fullName',item.provided_name,'phone',item.phone,'ip',host(item.observed_ip),'recordedAt',item.recorded_at,'expiresAt',item.expires_at,'noticeVersion',item.notice_version);
end $$;
revoke all on function public.hm_read_sender_evidence(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.hm_read_sender_evidence(uuid,text,text,text) to service_role;
select cron.schedule('hocco-sender-evidence-48h','* * * * *','select public.hm_purge_sender_evidence();');

commit;

