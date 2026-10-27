CREATE OR REPLACE FUNCTION public.hm_create_order(p_code text, p_tracking_hash text, p_name text, p_message text, p_phone text, p_opt_in boolean, p_reminder_opt_in boolean, p_social_platform text, p_social_handle text, p_slot integer, p_legal_version text, p_expected_price integer, p_settings_version integer)
 RETURNS hm_orders
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_settings; o public.hm_orders; used integer;
begin
  if p_legal_version is null or p_legal_version not in ('2026-10-27.v11','2026-10-26.v10') then raise exception 'Atualize os documentos e aceite novamente.'; end if;
  if p_slot not between 1 and 2 then raise exception 'Posição inválida.'; end if;
  if p_social_platform not in ('instagram','tiktok') or p_social_handle !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'Perfil social inválido.'; end if;
  if (p_opt_in or p_reminder_opt_in) and p_phone !~ '^(55)?[1-9][0-9]{9,10}$' then raise exception 'WhatsApp inválido.'; end if;
  select * into cfg from public.hm_settings where id=1 for update;
  if cfg.demo_mode or cfg.pix_key='' or cfg.payee_name='' or cfg.payee_city='' or cfg.publication_deadline is null or cfg.publication_deadline<=now() or cfg.display_duration_seconds is null then
    raise exception 'O envio de pedidos está temporariamente indisponível.';
  end if;
  select * into o from public.hm_orders where tracking_hash=p_tracking_hash;
  if found then return o; end if;
  if p_expected_price is distinct from (cfg.prices->>(p_slot-1))::integer or p_settings_version is distinct from cfg.version then
    raise exception 'Os preços ou a oferta mudaram. Confira o valor atualizado antes de continuar.';
  end if;
  select count(*) into used from public.hm_orders where is_demo=false and archived_at is null and episode=cfg.episode and slot=p_slot and review<>'rejected';
  if used>=cfg.capacity_per_slot then raise exception 'Esta posição está esgotada neste episódio.'; end if;
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
end; $function$
;
alter table public.hm_community_messages add column acceptance jsonb;
create function public.hm_create_community_purchase(p_data jsonb) returns public.hm_community_messages language plpgsql security invoker set search_path='' as $$
declare cfg public.hm_settings; result public.hm_community_messages; price integer;
begin
 if p_data->>'legal_version' is distinct from '2026-10-27.v11' or p_data->>'terms' is distinct from 'true' then raise exception 'Confirme os termos e a autorização.';end if;
 if p_data->>'destination' not in ('community','live') then raise exception 'Destino inválido.';end if;
 select * into result from public.hm_community_messages where tracking_hash=p_data->>'tracking_hash';if found then return result;end if;
 select * into cfg from public.hm_settings where id=1 for update;
 price:=case when p_data->>'destination'='live' then cfg.live_price_cents else cfg.community_price_cents end;
 if (p_data->>'expected_price')::integer is distinct from price then raise exception 'O preço mudou. Abra novamente o envio para conferir o valor antes de continuar.';end if;
 if coalesce((p_data->>'requires_review')::boolean,false) then result:=public.hm_create_community_message_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::integer,p_data->>'message',p_data->>'destination');
 else result:=public.hm_create_community_message_auto_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::integer,p_data->>'message',p_data->>'destination');end if;
 if result.destination='live' and result.live_scheduled_at is distinct from (p_data->>'live_scheduled_at')::timestamptz then raise exception 'A programação mudou. Confira a próxima LIVE antes de continuar.';end if;
 update public.hm_community_messages set acceptance=jsonb_build_object('version',p_data->>'legal_version','acceptedAt',now(),'terms',true,'adultDeclared',true,'publicationAuthorized',true,'priceCents',price) where id=result.id returning * into result;
 return result;
end $$;
revoke all on function public.hm_create_community_purchase(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_community_purchase(jsonb) to service_role;
