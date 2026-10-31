-- Remove unpaid comment content at 20 minutes while retaining only financial identity.
create table public.hm_expired_purchases (
 kind text not null check(kind in ('order','community')),
 code text not null,
 order_id uuid not null,
 tracking_hash text not null check(tracking_hash ~ '^[a-f0-9]{64}$'),
 price_cents integer not null check(price_cents>0),
 created_at timestamptz not null,
 expired_at timestamptz not null default now(),
 primary key(kind,code), unique(kind,tracking_hash), unique(kind,order_id)
);
alter table public.hm_expired_purchases enable row level security;
revoke all on public.hm_expired_purchases from public,anon,authenticated;
grant select,insert,update,delete on public.hm_expired_purchases to service_role;
create index if not exists hm_payments_kind_code_idx on public.hm_payments(kind,code);
create index if not exists hm_payments_order_id_idx on public.hm_payments(order_id);
create index hm_orders_unpaid_expiry_idx on public.hm_orders(created_at) where payment='pending' and not is_demo;
create index hm_community_unpaid_expiry_idx on public.hm_community_messages(created_at) where payment='pending';

create function public.hm_expire_unpaid_comments() returns jsonb
language plpgsql security invoker set search_path='' as $expiry$
declare kind text; tbl text; item jsonb; removed_orders integer:=0; removed_community integer:=0;
begin
 for kind in select unnest(array['order','community']) loop
  tbl:=case kind when 'order' then 'hm_orders' else 'hm_community_messages' end;
  for item in execute format(
   'select to_jsonb(t) from public.%I t where payment=''pending'' and not payment_hold and mercado_pago_payment_id is null and created_at<=now()-interval ''20 minutes'' %s and not exists(select 1 from public.hm_payments p where p.order_id=t.id or (p.kind=$1 and p.code=t.code)) order by created_at limit 1000 for update of t skip locked',
   tbl,case kind when 'order' then 'and not is_demo and delivery<>''published''' else 'and published_at is null' end) using kind
  loop
   insert into public.hm_expired_purchases(kind,code,order_id,tracking_hash,price_cents,created_at)
    values(kind,item->>'code',(item->>'id')::uuid,item->>'tracking_hash',(item->>'price_cents')::integer,(item->>'created_at')::timestamptz) on conflict do nothing;
   if kind='order' then
    delete from public.hm_audit where order_id=(item->>'id')::uuid;
    delete from public.hm_orders where id=(item->>'id')::uuid;
    removed_orders:=removed_orders+1;
   else
    delete from public.hm_community_audit where post_id=(item->>'id')::uuid;
    delete from public.hm_community_messages where id=(item->>'id')::uuid;
    removed_community:=removed_community+1;
   end if;
  end loop;
 end loop;
 return jsonb_build_object('ordersRemoved',removed_orders,'commentsRemoved',removed_community);
end $expiry$;
revoke all on function public.hm_expire_unpaid_comments() from public,anon,authenticated;
grant execute on function public.hm_expire_unpaid_comments() to service_role;


CREATE OR REPLACE FUNCTION public.hm_create_order(p_code text, p_tracking_hash text, p_name text, p_message text, p_phone text, p_opt_in boolean, p_reminder_opt_in boolean, p_social_platform text, p_social_handle text, p_slot integer, p_legal_version text, p_expected_price integer, p_settings_version integer)
 RETURNS hm_orders
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_settings; o public.hm_orders; used integer;
begin
  perform public.hm_expire_unpaid_comments();
  if exists(select 1 from public.hm_expired_purchases where kind='order' and tracking_hash=p_tracking_hash) then raise exception 'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem.';end if;
  if p_legal_version is null or p_legal_version not in ('2026-10-31.v12') then raise exception 'Atualize os documentos e aceite novamente.'; end if;
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
  select count(*) into used from public.hm_orders where is_demo=false and archived_at is null and episode=cfg.episode and slot=p_slot and review<>'rejected' and (payment<>'pending' or created_at>now()-interval '20 minutes');
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
 if p_data->>'legal_version' is distinct from '2026-10-31.v12' or p_data->>'terms' is distinct from 'true' then raise exception 'Confirme os termos e a autorização.';end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.hm_community_set_like(p_message_id uuid, p_voter_hash text, p_liked boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  m public.hm_community_messages;
  affected integer := 0;
begin
  if p_voter_hash !~ '^[a-f0-9]{64}$' or p_liked is null then
    raise exception 'Curtida inválida.';
  end if;

  select * into m
  from public.hm_community_messages
  where id = p_message_id
    and destination in ('community','live')
    and hidden_at is null
    and not payment_hold
    and review = 'approved'
    and payment = 'confirmed'
    and published_at is not null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Esta mensagem não está mais ativa na Comunidade.';
  end if;

  if p_liked then
    insert into public.hm_community_likes(message_id, voter_hash)
    values (p_message_id, p_voter_hash)
    on conflict (message_id, voter_hash) do nothing;
    get diagnostics affected = row_count;
    if affected = 1 then
      update public.hm_community_messages
      set likes_count = likes_count + 1
      where id = p_message_id
      returning * into m;
    end if;
  else
    delete from public.hm_community_likes
    where message_id = p_message_id and voter_hash = p_voter_hash;
    get diagnostics affected = row_count;
    if affected = 1 then
      update public.hm_community_messages
      set likes_count = greatest(0, likes_count - 1)
      where id = p_message_id
      returning * into m;
    end if;
  end if;

  return jsonb_build_object('likesCount', m.likes_count, 'liked', p_liked);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hm_apply_verified_payment(p_kind text, p_code text, p_payment_id text, p_amount_cents integer, p_status text, p_updated_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare tbl text; item jsonb; previous public.hm_payments; existing_id text; disputed boolean; stamp timestamptz:=now(); expired public.hm_expired_purchases; invalid_target boolean:=false;
begin
 if p_kind not in ('order','community','sponsor') or p_payment_id !~ '^[0-9]{1,40}$' or p_status not in ('approved','refunded','charged_back','in_mediation') or p_updated_at is null then raise exception 'Evento de pagamento inválido.'; end if;
 tbl:=case p_kind when 'order' then 'hm_orders' when 'community' then 'hm_community_messages' else 'hm_sponsors' end;
 execute format('select to_jsonb(t) from public.%I t where code=$1 for update',tbl) into item using p_code;

 if item is null then
  select * into expired from public.hm_expired_purchases where kind=p_kind and code=p_code for update;
  if not found then raise exception 'Pedido não encontrado.';end if;
  if expired.price_cents<>p_amount_cents then raise exception 'Valor divergente.';end if;
  select * into previous from public.hm_payments where provider_payment_id=p_payment_id for update;
  if found then
   if previous.kind<>p_kind or previous.order_id<>expired.order_id then raise exception 'Pagamento vinculado a outro pedido.';end if;
   if previous.provider_updated_at>p_updated_at then return jsonb_build_object('ignored',true);end if;
  end if;
  insert into public.hm_payments(provider_payment_id,kind,order_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
  values(p_payment_id,p_kind,expired.order_id,p_code,p_amount_cents,p_status,p_updated_at,p_status<>'refunded')
  on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=excluded.needs_attention,updated_at=now();
  return jsonb_build_object('received',true,'expired_purchase',true,'needs_attention',p_status<>'refunded');
 end if;
 invalid_target:=item->>'archived_at' is not null or item->>'hidden_at' is not null
  or (item->>'payment'='pending' and p_kind in ('order','community') and (item->>'created_at')::timestamptz<=stamp-interval '20 minutes')
  or (item->>'payment'='pending' and p_kind='order' and (item->>'publication_deadline')::timestamptz<=stamp);

 if (item->>'price_cents')::integer<>p_amount_cents then raise exception 'Valor divergente.'; end if;
 select * into previous from public.hm_payments where provider_payment_id=p_payment_id for update;
 if found then
  if previous.kind<>p_kind or previous.order_id<>(item->>'id')::uuid then raise exception 'Pagamento já vinculado a outro pedido.'; end if;
  if previous.provider_updated_at>p_updated_at then return jsonb_build_object('ignored',true); end if;
 end if;
 existing_id:=item->>'mercado_pago_payment_id';
 if existing_id is not null and existing_id<>p_payment_id then
  insert into public.hm_payments(provider_payment_id,kind,order_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
  values(p_payment_id,p_kind,(item->>'id')::uuid,p_code,p_amount_cents,p_status,p_updated_at,true)
  on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=true,updated_at=now();
  return jsonb_build_object('duplicate_payment',true,'needs_attention',true);
 end if;
 disputed:=p_status in ('charged_back','in_mediation');
 insert into public.hm_payments(provider_payment_id,kind,order_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
 values(p_payment_id,p_kind,(item->>'id')::uuid,p_code,p_amount_cents,p_status,p_updated_at,disputed or (p_status='approved' and (item->>'review'='rejected' or invalid_target)))
 on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=excluded.needs_attention,updated_at=now();
 if p_status='approved' and item->>'payment'='pending' then
  execute format('update public.%I set payment=''confirmed'',mercado_pago_payment_id=$1,payment_claimed=false,updated_at=now() where id=$2',tbl) using p_payment_id,(item->>'id')::uuid;
  if p_kind='order' then insert into public.hm_audit(order_id,action,detail) values((item->>'id')::uuid,'pay',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id));
  elsif p_kind='sponsor' then insert into public.hm_alex_events(event_type,detail) values('system_event',jsonb_build_object('object','sponsor','action','payment_confirmed','sponsor_id',item->>'id','code',p_code,'payment_id',p_payment_id));
  else insert into public.hm_community_audit(post_id,action,detail) values((item->>'id')::uuid,'payment_confirmed',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id)); end if;
 end if;
 if p_status='approved' then
  -- Never republish a refund, a rejection, or a second payment. Sponsor activation remains human-curated.
  execute format('update public.%I set mercado_pago_payment_id=$1,payment_hold=$3 where id=$2 and payment=''confirmed''',tbl) using p_payment_id,(item->>'id')::uuid,invalid_target;
  if p_kind='community' and not invalid_target then
   update public.hm_community_messages set published_at=stamp,expires_at=stamp+make_interval(hours=>duration_hours),
    live_status=case when destination='live' then coalesce(live_status,'queued') else live_status end,updated_at=stamp
   where id=(item->>'id')::uuid and payment='confirmed' and review='approved' and published_at is null and hidden_at is null;
  end if;
 elsif p_status='refunded' then
  if p_kind='community' then update public.hm_community_messages set payment='refunded',published_at=null,expires_at=null,live_status=null,payment_hold=false,mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  elsif p_kind='sponsor' then update public.hm_sponsors set payment='refunded',starts_at=null,expires_at=null,next_thank_at=null,next_expiry_notice_at=null,payment_hold=false,mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  else
   -- A previously delivered video cannot be un-delivered; retain that fact and record its refund in the ledger.
   update public.hm_orders set payment=case when delivery='published' then payment else 'refunded' end,payment_hold=(delivery='published'),mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  end if;
 else
  execute format('update public.%I set payment_hold=true,mercado_pago_payment_id=$1,updated_at=now() where id=$2',tbl) using p_payment_id,(item->>'id')::uuid;
 end if;
 return jsonb_build_object('received',true,'updated',true);
end $function$
;

revoke all on function public.hm_create_order(text,text,text,text,text,boolean,boolean,text,text,integer,text,integer,integer) from public,anon,authenticated;
grant execute on function public.hm_create_order(text,text,text,text,text,boolean,boolean,text,text,integer,text,integer,integer) to service_role;

revoke all on function public.hm_create_community_purchase(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_community_purchase(jsonb) to service_role;

revoke all on function public.hm_community_set_like(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.hm_community_set_like(uuid,text,boolean) to service_role;

revoke all on function public.hm_apply_verified_payment(text,text,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.hm_apply_verified_payment(text,text,text,integer,text,timestamptz) to service_role;
