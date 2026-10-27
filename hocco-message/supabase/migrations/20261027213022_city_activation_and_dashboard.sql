create function public.hm_guard_city_sponsor_activation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.expires_at is not null and new.review='approved' and new.payment='confirmed' and new.archived_at is null then
  perform 1 from public.hm_sponsor_settings where id=1 for update;
  if (select count(distinct cnpj) from public.hm_sponsors where city_key=public.hm_city_key(new.city,new.state_code) and id<>new.id and cnpj is distinct from new.cnpj and archived_at is null and review='approved' and payment='confirmed' and not payment_hold and starts_at<new.expires_at and expires_at>new.starts_at)>=50 then raise exception 'A cidade já atingiu 50 empresas neste período. Aguarde uma vaga ou trate a devolução.';end if;
 end if;
 return new;
end $$;
revoke all on function public.hm_guard_city_sponsor_activation() from public,anon,authenticated;
grant execute on function public.hm_guard_city_sponsor_activation() to service_role;
create trigger hm_guard_city_sponsor_activation before insert or update of review,payment,starts_at,expires_at,archived_at on public.hm_sponsors for each row execute function public.hm_guard_city_sponsor_activation();
create function public.hm_city_dashboard() returns setof jsonb language sql security invoker set search_path='' as $$
 select to_jsonb(m)||jsonb_build_object(
 'visits_7d',coalesce((select sum(total) from public.hm_city_daily d where d.city_key=m.city_key and day>=(now() at time zone 'America/Sao_Paulo')::date-6),0),
 'visits_30d',coalesce((select sum(total) from public.hm_city_daily d where d.city_key=m.city_key and day>=(now() at time zone 'America/Sao_Paulo')::date-29),0),
 'active_sponsors',(select count(*) from public.hm_sponsors s where s.city_key=m.city_key and archived_at is null and review='approved' and payment='confirmed' and not payment_hold and starts_at<=now() and expires_at>now()),
 'daily',coalesce((select jsonb_agg(jsonb_build_object('day',day,'total',total) order by day desc) from public.hm_city_daily d where d.city_key=m.city_key and day>=(now() at time zone 'America/Sao_Paulo')::date-29),'[]'::jsonb))
 from public.hm_city_markets m order by (status='ready') desc,updated_at desc limit 1000;
$$;
revoke all on function public.hm_city_dashboard() from public,anon,authenticated;
grant execute on function public.hm_city_dashboard() to service_role;
create function public.hm_admin_city_market(p_actor uuid,p_city text,p_uf text,p_status text) returns public.hm_city_markets language plpgsql security invoker set search_path='' as $$
declare k text; previous text; result public.hm_city_markets;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.';end if;
 if p_status not in ('observing','review','open','paused') or char_length(trim(p_city)) not between 2 and 80 or p_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'Cidade inválida.';end if;
 k:=public.hm_city_key(p_city,p_uf);
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 select status into previous from public.hm_city_markets where city_key=k for update;
 insert into public.hm_city_markets(city_key,city,state_code,status) values(k,trim(p_city),p_uf,p_status) on conflict(city_key) do update set status=excluded.status,updated_at=now() returning * into result;
 insert into public.hm_alex_events(event_type,severity,detail) values('system_event','info',jsonb_build_object('object','city_market','city',p_city,'uf',p_uf,'previous',previous,'status',p_status,'actor_id',p_actor));
 return result;
end $$;
revoke all on function public.hm_admin_city_market(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.hm_admin_city_market(uuid,text,text,text) to service_role;

revoke all on function public.hm_create_sponsor(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.hm_create_sponsor(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,boolean,uuid) to service_role;
