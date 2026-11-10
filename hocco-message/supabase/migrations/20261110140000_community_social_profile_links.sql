-- Community message social profile links: optional Instagram/TikTok profile target.
alter table public.hm_community_messages
  add column if not exists social_url text;

alter table public.hm_community_messages
  drop constraint if exists hm_community_messages_social_url_https_check;

alter table public.hm_community_messages
  add constraint hm_community_messages_social_url_https_check
  check (social_url is null or (social_url like 'https://www.instagram.com/%' or social_url like 'https://www.tiktok.com/@%'));

create or replace function public.hm_create_community_message_v2(
 p_code text,p_tracking_hash text,p_name text,p_username text,
 p_avatar_index smallint,p_message text,p_destination text,p_social_url text default null
)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare m public.hm_community_messages; message_price integer;
begin
 if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then raise exception 'Identificador de envio inválido.'; end if;
 if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
 if p_social_url is not null and p_social_url !~ '^https://www\\.(instagram\\.com/[^/]+/?|tiktok\\.com/@[^/]+/?)(\\?.*)?$' then raise exception 'Link de rede social inválido.'; end if;
 if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
    or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
   raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
 end if;
 select case when p_destination='live' then live_price_cents else community_price_cents end
   into message_price from public.hm_settings where id=1;
 if message_price is null then raise exception 'Os preços da Comunidade estão temporariamente indisponíveis.'; end if;
 select * into m from public.hm_community_messages where tracking_hash=p_tracking_hash;
 if found then return m; end if;
 insert into public.hm_community_messages(code,tracking_hash,member_name,member_username,avatar_index,message,destination,price_cents,social_url)
 values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),p_destination,message_price,p_social_url)
 returning * into m;
 insert into public.hm_community_audit(post_id,action,detail)
 values(m.id,'created',jsonb_build_object('price_cents',m.price_cents,'destination',m.destination,'social_url',m.social_url));
 return m;
end;
$function$;

create or replace function public.hm_create_community_message_auto_v2(
 p_code text,p_tracking_hash text,p_name text,p_username text,
 p_avatar_index smallint,p_message text,p_destination text,p_social_url text default null
)
returns public.hm_community_messages
language plpgsql
security definer
set search_path to ''
as $function$
declare m public.hm_community_messages; message_price integer;
begin
 if p_code !~ '^HC-CM-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' then raise exception 'Identificador de envio inválido.'; end if;
 if p_destination is null or p_destination not in ('community','live') then raise exception 'Destino inválido.'; end if;
 if p_social_url is not null and p_social_url !~ '^https://www\\.(instagram\\.com/[^/]+/?|tiktok\\.com/@[^/]+/?)(\\?.*)?$' then raise exception 'Link de rede social inválido.'; end if;
 if char_length(trim(p_name)) not between 1 and 40 or p_username !~ '^[A-Za-z0-9._]{3,24}$'
    or p_avatar_index not between 1 and 20 or char_length(trim(p_message)) not between 1 and 180 then
   raise exception 'Confira seu perfil e a mensagem de até 180 caracteres.';
 end if;
 select case when p_destination='live' then live_price_cents else community_price_cents end
   into message_price from public.hm_settings where id=1;
 if message_price is null then raise exception 'Os preços da Comunidade estão temporariamente indisponíveis.'; end if;
 insert into public.hm_community_messages
   (code,tracking_hash,member_name,member_username,avatar_index,message,review,destination,price_cents,social_url)
 values(p_code,p_tracking_hash,trim(p_name),p_username,p_avatar_index,trim(p_message),'approved',p_destination,message_price,p_social_url)
 on conflict (tracking_hash) do nothing returning * into m;
 if not found then select * into m from public.hm_community_messages where tracking_hash=p_tracking_hash; return m; end if;
 insert into public.hm_community_audit(post_id,action,detail)
 values(m.id,'created',jsonb_build_object('price_cents',m.price_cents,'destination',m.destination,'moderation','rules-v1','decision','approved','social_url',m.social_url));
 return m;
end;
$function$;

create or replace function public.hm_create_community_purchase(p_data jsonb)
returns public.hm_community_messages
language plpgsql
set search_path to ''
as $function$
declare cfg public.hm_settings; result public.hm_community_messages; price integer;
begin
 perform public.hm_expire_unpaid_comments();
 perform pg_advisory_xact_lock(hashtextextended('hm-community:'||(p_data->>'tracking_hash'),0));
 if exists(select 1 from public.hm_expired_purchases where kind='community' and tracking_hash=p_data->>'tracking_hash') then raise exception 'O prazo de 20 minutos terminou. O comentário não pago foi excluído. Envie uma nova mensagem.'; end if;
 if (p_data->>'legal_version' is null or p_data->>'legal_version' not in ('2026-10-31.v12','2026-11-03.v13')) or p_data->>'terms' is distinct from 'true' then raise exception 'Confirme os termos e a autorização.'; end if;
 if p_data->>'destination' not in ('community','live') then raise exception 'Destino inválido.'; end if;
 select * into result from public.hm_community_messages where tracking_hash=p_data->>'tracking_hash'; if found then return result; end if;
 select * into cfg from public.hm_settings where id=1 for update;
 price:=case when p_data->>'destination'='live' then cfg.live_price_cents else cfg.community_price_cents end;
 if (p_data->>'expected_price')::integer is distinct from price then raise exception 'O preço mudou. Abra novamente o envio para conferir o valor antes de continuar.'; end if;
 if coalesce((p_data->>'requires_review')::boolean,false) then
   result:=public.hm_create_community_message_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::smallint,p_data->>'message',p_data->>'destination',nullif(p_data->>'social_url',''));
 else
   result:=public.hm_create_community_message_auto_v2(p_data->>'code',p_data->>'tracking_hash',p_data->>'name',p_data->>'username',(p_data->>'avatar')::smallint,p_data->>'message',p_data->>'destination',nullif(p_data->>'social_url',''));
 end if;
 if result.destination='live' and result.live_scheduled_at is distinct from (p_data->>'live_scheduled_at')::timestamptz then raise exception 'A programação mudou. Confira a próxima LIVE antes de continuar.'; end if;
 update public.hm_community_messages set acceptance=jsonb_build_object('version',p_data->>'legal_version','acceptedAt',now(),'terms',true,'adultDeclared',true,'publicationAuthorized',true,'priceCents',price) where id=result.id returning * into result;
 return result;
end;
$function$;

revoke all on function public.hm_create_community_message_v2(text,text,text,text,smallint,text,text,text) from public,anon,authenticated;
grant execute on function public.hm_create_community_message_v2(text,text,text,text,smallint,text,text,text) to service_role;
revoke all on function public.hm_create_community_message_auto_v2(text,text,text,text,smallint,text,text,text) from public,anon,authenticated;
grant execute on function public.hm_create_community_message_auto_v2(text,text,text,text,smallint,text,text,text) to service_role;
