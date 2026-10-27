create or replace function public.hm_create_community_purchase(p_data jsonb) returns public.hm_community_messages language plpgsql security invoker set search_path='' as $$
declare cfg public.hm_settings; result public.hm_community_messages; price integer;
begin
 if p_data->>'legal_version' is distinct from '2026-10-27.v11' or p_data->>'terms' is distinct from 'true' then raise exception 'Confirme os termos e a autorização.';end if;
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
end $$;
