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
