alter table public.hm_settings
  add column if not exists community_price_cents integer not null default 350,
  add column if not exists live_price_cents integer not null default 550;

alter table public.hm_settings
  add constraint hm_settings_community_price_cents_check
    check (community_price_cents between 1 and 999900),
  add constraint hm_settings_live_price_cents_check
    check (live_price_cents between 1 and 999900);

alter table public.hm_community_messages
  drop constraint if exists hm_community_messages_destination_price_check;
alter table public.hm_community_messages
  add constraint hm_community_messages_destination_price_check
    check (price_cents between 1 and 999900);

create or replace function public.hm_create_community_message_v2(
  p_code text, p_tracking_hash text, p_name text, p_username text,
  p_avatar_index smallint, p_message text, p_destination text
)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; message_price integer;
begin
  if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de envio inválido.';
  end if;
  if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
  if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
     or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
    raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
  end if;
  select case when p_destination='live' then live_price_cents else community_price_cents end
    into message_price from public.hm_settings where id=1;
  if message_price is null then raise exception 'Os preços da Comunidade estão temporariamente indisponíveis.'; end if;
  select * into m from public.hm_community_messages where tracking_hash=p_tracking_hash;
  if found then return m; end if;
  insert into public.hm_community_messages(code,tracking_hash,member_name,member_username,avatar_index,message,destination,price_cents)
  values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),p_destination,message_price)
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
declare m public.hm_community_messages; message_price integer;
begin
  if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador de envio inválido.';
  end if;
  if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
  if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
     or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
    raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
  end if;
  select case when p_destination='live' then live_price_cents else community_price_cents end
    into message_price from public.hm_settings where id=1;
  if message_price is null then raise exception 'Os preços da Comunidade estão temporariamente indisponíveis.'; end if;
  insert into public.hm_community_messages
    (code,tracking_hash,member_name,member_username,avatar_index,message,review,destination,price_cents)
  values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),'approved',p_destination,message_price)
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
