alter table public.hm_community_messages
  add column if not exists destination text not null default 'community',
  add column if not exists live_status text;

alter table public.hm_community_messages
  drop constraint if exists hm_community_messages_price_cents_check;

alter table public.hm_community_messages
  add constraint hm_community_messages_destination_check
    check (destination in ('community','live')),
  add constraint hm_community_messages_destination_price_check
    check ((destination='community' and price_cents=350) or (destination='live' and price_cents=550)),
  add constraint hm_community_messages_live_status_check
    check (live_status is null or live_status in ('queued','read'));

create index if not exists hm_community_live_queue_idx
  on public.hm_community_messages (created_at)
  where destination='live' and live_status='queued' and review='approved' and payment='confirmed';

create or replace function public.hm_create_community_message_v2(
  p_code text, p_tracking_hash text, p_name text, p_username text,
  p_avatar_index smallint, p_message text, p_destination text
)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages;
begin
  if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de envio inválido.';
  end if;
  if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
  if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
     or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
    raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
  end if;
  select * into m from public.hm_community_messages where tracking_hash=p_tracking_hash;
  if found then return m; end if;
  insert into public.hm_community_messages(code,tracking_hash,member_name,member_username,avatar_index,message,destination,price_cents)
  values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),p_destination,
    case when p_destination='live' then 550 else 350 end)
  returning * into m;
  insert into public.hm_community_audit(post_id,action,detail)
  values(m.id,'created',jsonb_build_object('price_cents',m.price_cents,'destination',m.destination));
  return m;
end;
$function$;

create or replace function public.hm_create_community_message_auto_v2(
  p_code text, p_tracking_hash text, p_name text, p_username text,
  p_avatar_index smallint, p_message text, p_destination text
)
returns public.hm_community_messages
language plpgsql
security definer
set search_path to ''
as $function$
declare m public.hm_community_messages;
begin
  if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de envio inválido.';
  end if;
  if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
  if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
     or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
    raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
  end if;
  insert into public.hm_community_messages
    (code,tracking_hash,member_name,member_username,avatar_index,message,review,destination,price_cents)
  values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),'approved',p_destination,
    case when p_destination='live' then 550 else 350 end)
  on conflict (tracking_hash) do nothing returning * into m;
  if not found then select * into m from public.hm_community_messages where tracking_hash=p_tracking_hash; return m; end if;
  insert into public.hm_community_audit(post_id,action,detail)
  values(m.id,'created',jsonb_build_object('price_cents',m.price_cents,'destination',m.destination,'moderation','rules-v1','decision','approved'));
  return m;
end;
$function$;

revoke all on function public.hm_create_community_message_v2(text,text,text,text,smallint,text,text) from public, anon, authenticated;
revoke all on function public.hm_create_community_message_auto_v2(text,text,text,text,smallint,text,text) from public, anon, authenticated;
grant execute on function public.hm_create_community_message_v2(text,text,text,text,smallint,text,text) to service_role;
grant execute on function public.hm_create_community_message_auto_v2(text,text,text,text,smallint,text,text) to service_role;

create or replace function public.hm_confirm_community_payment(p_id uuid, p_payment_id text)
returns public.hm_community_messages
language plpgsql
security definer
set search_path to ''
as $function$
declare m public.hm_community_messages; published timestamptz;
begin
  if p_payment_id !~ '^[0-9]{1,40}$' then raise exception 'Identificador do pagamento inválido.'; end if;
  select * into m from public.hm_community_messages where id=p_id for update;
  if not found then raise exception 'Mensagem da Comunidade não encontrada.'; end if;
  if m.payment='confirmed' then
    if m.mercado_pago_payment_id=p_payment_id then return m; end if;
    raise exception 'A mensagem já possui outro pagamento confirmado.';
  end if;
  if m.payment<>'pending' or m.review='rejected' then raise exception 'A mensagem não pode receber este pagamento.'; end if;
  if m.review='approved' and m.destination='community' then
    published:=coalesce(m.published_at,now());
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,published_at=published,expires_at=published+interval '3 hours',live_status=null,updated_at=now() where id=p_id returning * into m;
  elsif m.review='approved' and m.destination='live' then
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,live_status=coalesce(live_status,'queued'),updated_at=now() where id=p_id returning * into m;
  else
    update public.hm_community_messages set payment='confirmed',payment_claimed=false,mercado_pago_payment_id=p_payment_id,updated_at=now() where id=p_id returning * into m;
  end if;
  insert into public.hm_community_audit(post_id,action,detail)
  values(m.id,'payment_confirmed',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id,'published_automatically',m.published_at is not null,'destination',m.destination,'queued_for_live',m.live_status='queued'));
  return m;
end;
$function$;

create or replace function public.hm_community_admin_action(p_actor uuid, p_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; reason text:=trim(coalesce(p_payload->>'reason',''));
begin
  if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
  select * into m from public.hm_community_messages where id=p_id for update;
  if not found then raise exception 'Mensagem da comunidade não encontrada.'; end if;
  case p_action
    when 'pay' then if m.payment<>'pending' or m.review='rejected' then raise exception 'Não é possível confirmar esse pagamento.'; end if; m.payment:='confirmed';
    when 'approve' then if m.review<>'pending' then raise exception 'A curadoria já foi concluída.'; end if; m.review:='approved';
    when 'reject' then if m.review<>'pending' or char_length(reason) not between 2 and 500 then raise exception 'Informe o motivo da recusa.'; end if; m.review:='rejected'; m.reason:=reason;
    when 'refund' then if m.review<>'rejected' or m.payment<>'confirmed' then raise exception 'Não há devolução pendente.'; end if; m.payment:='refunded';
    when 'live_read' then if m.destination<>'live' or m.payment<>'confirmed' or m.review<>'approved' or m.live_status<>'queued' then raise exception 'Esta mensagem não está na fila da LIVE.'; end if; m.live_status:='read';
    else raise exception 'Ação de curadoria inválida.';
  end case;
  if m.review='approved' and m.payment='confirmed' then
    if m.destination='community' and m.published_at is null then m.published_at:=now(); m.expires_at:=m.published_at+interval '3 hours'; end if;
    if m.destination='live' and m.live_status is null then m.live_status:='queued'; end if;
  end if;
  m.updated_at:=now();
  update public.hm_community_messages set review=m.review,payment=m.payment,reason=m.reason,published_at=m.published_at,expires_at=m.expires_at,live_status=m.live_status,updated_at=m.updated_at where id=m.id returning * into m;
  insert into public.hm_community_audit(post_id,actor_id,action,detail)
  values(m.id,p_actor,p_action,case when p_action='reject' then jsonb_build_object('reason',reason) else jsonb_build_object('destination',m.destination) end);
  return m;
end;
$function$;
