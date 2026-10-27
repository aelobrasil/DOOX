-- Private expansion signals. No visitor IP, identity, URL or content is retained.
create function public.hm_city_key(p_city text,p_uf text) returns text language sql immutable set search_path='' as $$
 select regexp_replace(lower(translate(trim(p_city),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç','AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),'[^a-z0-9]+',' ','g')||':'||upper(p_uf)
$$;
revoke all on function public.hm_city_key(text,text) from public,anon,authenticated;
grant execute on function public.hm_city_key(text,text) to service_role;
create table public.hm_geo_config(id smallint primary key check(id=1),report_token_hash text not null check(report_token_hash ~ '^[a-f0-9]{64}$'));
create table public.hm_city_markets(city_key text primary key,city text not null check(char_length(city) between 2 and 80),state_code text not null check(state_code ~ '^[A-Z]{2}$'),status text not null default 'observing' check(status in ('observing','ready','review','open','paused')),qualified_on date,updated_at timestamptz not null default now());
create table public.hm_city_visits(day date not null,visitor_hash text not null check(visitor_hash ~ '^[a-f0-9]{64}$'),city_key text not null references public.hm_city_markets(city_key),primary key(day,visitor_hash));
create table public.hm_city_daily(day date not null,city_key text not null references public.hm_city_markets(city_key),total integer not null default 0 check(total>=0),primary key(city_key,day));
alter table public.hm_geo_config enable row level security;
alter table public.hm_city_markets enable row level security;
alter table public.hm_city_visits enable row level security;
alter table public.hm_city_daily enable row level security;
revoke all on public.hm_geo_config,public.hm_city_markets,public.hm_city_visits,public.hm_city_daily from public,anon,authenticated;
grant select,insert,update,delete on public.hm_geo_config,public.hm_city_markets,public.hm_city_visits,public.hm_city_daily to service_role;
create index hm_city_visits_day_idx on public.hm_city_visits(day);
create index hm_city_daily_day_idx on public.hm_city_daily(day);
alter table public.hm_sponsors add column city_key text generated always as (public.hm_city_key(city,state_code)) stored;
create index hm_sponsor_city_inventory_idx on public.hm_sponsors(city_key,review,payment,expires_at) where archived_at is null;
-- Preserve the availability of cities with existing registrations.
insert into public.hm_city_markets(city_key,city,state_code,status)
 select distinct on (city_key) city_key,city,state_code,'open' from public.hm_sponsors where char_length(city)>=2 and state_code<>'' order by city_key,created_at desc;
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

CREATE OR REPLACE FUNCTION public.hm_create_sponsor(p_code text, p_tracking_hash text, p_company_name text, p_cnpj text, p_legal_name text, p_category text, p_company_description text, p_contact_name text, p_email text, p_phone text, p_logo_url text, p_cover_url text, p_destination_url text, p_community_offer text, p_sponsor_terms_version text, p_thank_you_opt_in boolean, p_expiry_notice_opt_in boolean, p_renewal_of uuid DEFAULT NULL::uuid)
 RETURNS hm_sponsors
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cfg public.hm_sponsor_settings; s public.hm_sponsors; n integer;
begin
 select * into cfg from public.hm_sponsor_settings where id=1 for update;
 if not cfg.enabled then raise exception 'As inscrições de patrocinadores estão temporariamente fechadas.'; end if;
 if p_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' or char_length(trim(coalesce(p_legal_name,''))) not between 2 and 160 then raise exception 'Informe um CNPJ válido e a razão social da empresa.'; end if;
 if p_category not in ('Alimentação e bebidas','Casa e construção','Educação e cultura','Moda e acessórios','Serviços','Tecnologia','Outros') then raise exception 'Escolha uma categoria válida para a empresa.'; end if;
 if char_length(trim(coalesce(p_company_description,''))) not between 20 and 600 then raise exception 'A descrição da empresa deve ter entre 20 e 600 caracteres.'; end if;
 if exists(select 1 from public.hm_sponsors where tracking_hash=p_tracking_hash) then select * into s from public.hm_sponsors where tracking_hash=p_tracking_hash; return s; end if;
 if p_renewal_of is not null and not exists(select 1 from public.hm_sponsors where id=p_renewal_of and archived_at is null and lower(company_name)=lower(trim(p_company_name)) and cnpj=p_cnpj and review='approved' and payment='confirmed' and starts_at<=now() and expires_at>now()) then raise exception 'A renovação só pode ser solicitada para um patrocínio ativo da mesma empresa.'; end if;
 if p_renewal_of is not null and exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and renewal_of=p_renewal_of and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))))) then raise exception 'Já existe uma renovação em análise para esta empresa.'; end if;
 select count(distinct cnpj) into n from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))));
 if p_renewal_of is null and n>=cfg.capacity then raise exception 'No momento, não há espaço disponível. Tente novamente mais tarde.'; end if;
 if exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and cnpj=p_cnpj and id is distinct from p_renewal_of and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours'))))) then raise exception 'Este CNPJ já tem uma solicitação ou um patrocínio ativo.'; end if;
 if exists(select 1 from public.hm_sponsors where city_key=current_setting('hocco.sponsor_city_key',true) and archived_at is null and lower(company_name)=lower(trim(p_company_name)) and review<>'rejected' and (expires_at>now() or (expires_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '48 hours')))) and (p_renewal_of is null or (id<>p_renewal_of and renewal_of is distinct from p_renewal_of))) then raise exception 'Esta empresa já tem uma solicitação ou um patrocínio ativo.'; end if;
 if char_length(coalesce(p_community_offer,''))>240 then raise exception 'A oferta para a comunidade deve ter até 240 caracteres.'; end if;
 insert into public.hm_sponsors(code,tracking_hash,company_name,cnpj,legal_name,category,company_description,contact_name,email,phone,logo_url,cover_url,destination_url,community_offer,price_cents,renewal_of,thank_you_opt_in,expiry_notice_opt_in,consent)
 values(p_code,p_tracking_hash,trim(p_company_name),p_cnpj,trim(p_legal_name),p_category,trim(p_company_description),trim(p_contact_name),lower(trim(p_email)),regexp_replace(p_phone,'[^0-9]','','g'),p_logo_url,p_cover_url,p_destination_url,coalesce(trim(p_community_offer),''),cfg.price_cents,p_renewal_of,p_thank_you_opt_in,p_expiry_notice_opt_in,
 jsonb_build_object('acceptedAt',now(),'sponsorTermsVersion',p_sponsor_terms_version,'terms',true,'publication',true,'notificationsOptIn',p_thank_you_opt_in,'expiryOptIn',p_expiry_notice_opt_in,'communityOffer',coalesce(trim(p_community_offer),''),'category',p_category,'companyDescription',trim(p_company_description))) returning * into s;
 return s;
end;
$function$
 ;
create or replace function public.hm_create_sponsor_local(p_data jsonb) returns public.hm_sponsors language plpgsql security invoker set search_path='' as $$
declare s public.hm_sponsors; key text; market_status text;
begin
 if char_length(trim(coalesce(p_data->>'city',''))) not between 2 and 80 or p_data->>'state_code' not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'Informe a cidade e a UF.';end if;
 -- Retry returns the same order with its original price and location.
 select * into s from public.hm_sponsors where tracking_hash=p_data->>'p_tracking_hash';if found then return s;end if;
 key:=public.hm_city_key(p_data->>'city',p_data->>'state_code');
 select status into market_status from public.hm_city_markets where city_key=key for update;
 if market_status is distinct from 'open' then raise exception 'As inscrições ainda não estão abertas nesta cidade. Consulte as cidades disponíveis.';end if;
 perform set_config('hocco.sponsor_city_key',key,true);
 s:=public.hm_create_sponsor(p_data->>'p_code',p_data->>'p_tracking_hash',p_data->>'p_company_name',p_data->>'p_cnpj',p_data->>'p_legal_name',p_data->>'p_category',p_data->>'p_company_description',p_data->>'p_contact_name',p_data->>'p_email',p_data->>'p_phone',p_data->>'p_logo_url',p_data->>'p_cover_url',p_data->>'p_destination_url',p_data->>'p_community_offer',p_data->>'p_sponsor_terms_version',(p_data->>'p_thank_you_opt_in')::boolean,(p_data->>'p_expiry_notice_opt_in')::boolean,(p_data->>'p_renewal_of')::uuid);
 if p_data->>'expected_price' is not null and (p_data->>'expected_price')::integer is distinct from s.price_cents then raise exception 'O preço mudou. Confira o valor atualizado antes de continuar.';end if;
 update public.hm_sponsors set city=trim(p_data->>'city'),state_code=p_data->>'state_code',offer_conditions=coalesce(p_data->>'offer_conditions',''),offer_expires_on=(p_data->>'offer_expires_on')::date where id=s.id returning * into s;
 return s;
end $$;
revoke all on function public.hm_create_sponsor_local(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_sponsor_local(jsonb) to service_role;
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
