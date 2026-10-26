begin;
alter table public.hm_sponsors add column city text not null default '', add column state_code text not null default '', add column offer_conditions text not null default '', add column offer_expires_on date;
alter table public.hm_sponsors add constraint hm_sponsor_city_length check(char_length(city)<=80), add constraint hm_sponsor_state check(state_code='' or state_code in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')), add constraint hm_sponsor_offer_conditions check(char_length(offer_conditions)<=500);
create index hm_sponsor_location_idx on public.hm_sponsors(state_code,lower(city)) where archived_at is null;
create table public.hm_programming(id integer primary key check(id=1),topic text not null default '' check(char_length(topic)<=180),next_live_title text not null default '' check(char_length(next_live_title)<=120),next_live_at timestamptz,live_capacity integer not null default 50 check(live_capacity between 1 and 500),live_accepting boolean not null default false,updated_at timestamptz not null default now());
alter table public.hm_programming enable row level security;
revoke all on public.hm_programming from public,anon,authenticated;
grant select,insert,update on public.hm_programming to service_role;
insert into public.hm_programming(id) values(1);
alter table public.hm_community_messages add column live_scheduled_at timestamptz, add column live_title text;
create or replace function public.hm_snapshot_live_program() returns trigger language plpgsql security invoker set search_path='' as $$
declare cfg public.hm_programming; occupied integer;
begin
 if new.destination<>'live' or exists(select 1 from public.hm_community_messages where tracking_hash=new.tracking_hash) then return new; end if;
 select * into cfg from public.hm_programming where id=1 for update;
 if not cfg.live_accepting or cfg.next_live_at is null or cfg.next_live_at<=now() then raise exception 'A próxima LIVE ainda não está recebendo mensagens. Escolha Comunidade ou aguarde a programação.'; end if;
 select count(*) into occupied from public.hm_community_messages where destination='live' and live_scheduled_at=cfg.next_live_at and review<>'rejected' and payment<>'refunded' and hidden_at is null;
 if occupied>=cfg.live_capacity then raise exception 'A fila desta LIVE está completa. Aguarde a próxima programação.'; end if;
 new.live_scheduled_at:=cfg.next_live_at; new.live_title:=cfg.next_live_title;
 return new;
end $$;
create trigger hm_snapshot_live_program before insert on public.hm_community_messages for each row execute function public.hm_snapshot_live_program();
revoke all on function public.hm_snapshot_live_program() from public,anon,authenticated;
create or replace function public.hm_update_programming(p_actor uuid,p_payload jsonb) returns public.hm_programming language plpgsql security invoker set search_path='' as $$
declare old public.hm_programming; saved public.hm_programming;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
 select * into old from public.hm_programming where id=1 for update;
 update public.hm_programming set topic=p_payload->>'topic',next_live_title=p_payload->>'liveTitle',next_live_at=nullif(p_payload->>'liveAt','')::timestamptz,live_capacity=(p_payload->>'capacity')::integer,live_accepting=(p_payload->>'accepting')::boolean,updated_at=now() where id=1 returning * into saved;
 if saved.live_accepting and (saved.next_live_at is null or saved.next_live_at<=now() or char_length(saved.next_live_title)<2) then raise exception 'Defina título e data futura para abrir a fila da LIVE.'; end if;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'programming_update',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));
 return saved;
end $$;
revoke all on function public.hm_update_programming(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hm_update_programming(uuid,jsonb) to service_role;
create or replace function public.hm_create_sponsor_local(p_data jsonb) returns public.hm_sponsors language plpgsql security invoker set search_path='' as $$
declare s public.hm_sponsors;
begin
 if char_length(trim(coalesce(p_data->>'city',''))) not between 2 and 80 or p_data->>'state_code' not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception 'Informe a cidade e a UF.'; end if;
 s:=public.hm_create_sponsor(p_data->>'p_code',p_data->>'p_tracking_hash',p_data->>'p_company_name',p_data->>'p_cnpj',p_data->>'p_legal_name',p_data->>'p_category',p_data->>'p_company_description',p_data->>'p_contact_name',p_data->>'p_email',p_data->>'p_phone',p_data->>'p_logo_url',p_data->>'p_cover_url',p_data->>'p_destination_url',p_data->>'p_community_offer',p_data->>'p_sponsor_terms_version',(p_data->>'p_thank_you_opt_in')::boolean,(p_data->>'p_expiry_notice_opt_in')::boolean,(p_data->>'p_renewal_of')::uuid);
 -- Existing retries preserve the original registered location and terms.
 if s.city='' then
 update public.hm_sponsors set city=trim(p_data->>'city'),state_code=p_data->>'state_code',offer_conditions=coalesce(p_data->>'offer_conditions',''),offer_expires_on=(p_data->>'offer_expires_on')::date where id=s.id returning * into s;
 end if;
 return s;
end $$;
revoke all on function public.hm_create_sponsor_local(jsonb) from public,anon,authenticated;
grant execute on function public.hm_create_sponsor_local(jsonb) to service_role;

create table public.hm_sponsor_daily_metrics(day date not null,sponsor_id uuid not null,event text not null check(event in ('profile','click')),city text not null,state_code text not null,category text not null,total bigint not null default 0 check(total>=0),primary key(day,sponsor_id,event));
alter table public.hm_sponsor_daily_metrics enable row level security;
revoke all on public.hm_sponsor_daily_metrics from public,anon,authenticated;
grant select,insert,update on public.hm_sponsor_daily_metrics to service_role;
create or replace function public.hm_count_sponsor_event(p_id uuid,p_event text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_event not in ('profile','click') then raise exception 'Evento inválido.'; end if;
 insert into public.hm_sponsor_daily_metrics(day,sponsor_id,event,city,state_code,category,total)
 select (now() at time zone 'America/Sao_Paulo')::date,id,p_event,city,state_code,category,1 from public.hm_sponsors where id=p_id and archived_at is null and review='approved' and payment='confirmed' and not payment_hold and starts_at<=now() and expires_at>now()
 on conflict(day,sponsor_id,event) do update set total=public.hm_sponsor_daily_metrics.total+1;
end $$;
revoke all on function public.hm_count_sponsor_event(uuid,text) from public,anon,authenticated;
grant execute on function public.hm_count_sponsor_event(uuid,text) to service_role;

-- Only new community purchases use the agreed launch price. Existing orders are untouched.
update public.hm_settings set community_price_cents=350,live_price_cents=550,community_duration_hours=4,updated_at=now() where id=1;
insert into public.hm_audit(action,detail) values('community_pricing',jsonb_build_object('source','approved_launch_update','community_price_cents',350,'live_price_cents',550,'community_duration_hours',4));
commit;
