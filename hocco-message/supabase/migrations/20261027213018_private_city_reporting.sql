create function public.hm_geo_record(p_auth_hash text,p_city text,p_uf text,p_day date,p_visitor_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare key text; inserted_count integer; today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if not exists(select 1 from public.hm_geo_config where id=1 and report_token_hash=p_auth_hash) then raise exception 'Origem de métricas não autorizada.';end if;
 if p_day<>today or char_length(trim(p_city)) not between 2 and 80 or p_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') or p_visitor_hash !~ '^[a-f0-9]{64}$' then raise exception 'Métrica inválida.';end if;
 key:=public.hm_city_key(p_city,p_uf);
 insert into public.hm_city_markets(city_key,city,state_code) values(key,trim(p_city),p_uf) on conflict do nothing;
 insert into public.hm_city_visits(day,visitor_hash,city_key) values(today,p_visitor_hash,key) on conflict do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count=1 then insert into public.hm_city_daily(day,city_key,total) values(today,key,1) on conflict(city_key,day) do update set total=public.hm_city_daily.total+1;end if;
 -- Fixed, short retention for rotating daily hashes; only aggregate counts survive.
 delete from public.hm_city_visits where day<today-8;
 delete from public.hm_city_daily where day<today-90;
 return jsonb_build_object('recorded',inserted_count=1);
end $$;
revoke all on function public.hm_geo_record(text,text,text,date,text) from public,anon,authenticated;
grant execute on function public.hm_geo_record(text,text,text,date,text) to service_role;
create function public.hm_refresh_city_markets() returns void language sql security invoker set search_path='' as $$
 with qualified_days as (
  select city_key,day,day-(row_number() over(partition by city_key order by day))::integer as island from public.hm_city_daily where total>=100 and day<(now() at time zone 'America/Sao_Paulo')::date
 ),runs as(select city_key,min(day)+5 as qualified_on from qualified_days group by city_key,island having count(*)>=6),first_run as(select city_key,min(qualified_on) qualified_on from runs group by city_key)
 update public.hm_city_markets m set status=case when m.status='observing' and m.qualified_on is null then 'ready' else m.status end,qualified_on=coalesce(m.qualified_on,r.qualified_on),updated_at=now() from first_run r where r.city_key=m.city_key and m.qualified_on is null;
$$;
revoke all on function public.hm_refresh_city_markets() from public,anon,authenticated;
grant execute on function public.hm_refresh_city_markets() to service_role;
-- Existing purchases keep their stored price; this changes only future registrations.
update public.hm_sponsor_settings set price_cents=6990,updated_at=now() where id=1;

