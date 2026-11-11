-- Patrocinadores Oficiais do Reality HOCCO
-- Produto isolado do cadastro empresarial legado.
-- Acesso somente pelo backend service_role; não criar políticas anon/authenticated.

create table if not exists public.hm_reality_sponsor_settings (
 id smallint primary key default 1 check(id=1),
 price_cents integer not null default 3990 check(price_cents between 100 and 999999),
 capacity smallint not null default 50 check(capacity=50),
 duration_days smallint not null default 7 check(duration_days=7),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.hm_reality_sponsor_settings(id) values(1) on conflict(id) do nothing;

create table if not exists public.hm_reality_sponsors (
 id uuid primary key default gen_random_uuid(),
 sponsor_type text not null check(sponsor_type in ('person','company')),
 display_name text not null check(char_length(btrim(display_name)) between 2 and 80),
 username text not null check(username ~ '^[A-Za-z0-9._]{3,24}$'),
 segment text not null check(char_length(btrim(segment)) between 2 and 60),
 email text not null check(char_length(email) between 5 and 254),
 phone text not null default '',
 logo_url text,
 device_hash text check(device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','active','expired','cancelled','attention')),
 slot_no smallint check(slot_no between 1 and 50),
 starts_at timestamptz,
 expires_at timestamptz,
 renewal_opt_out boolean not null default false,
 renewal_notice_sent_at timestamptz,
 consent jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists hm_reality_sponsors_active_slot_idx on public.hm_reality_sponsors(slot_no) where status='active';

create table if not exists public.hm_reality_sponsor_orders (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.hm_reality_sponsors(id),
 code text not null unique check(code ~ '^HC-RS-[A-F0-9]{12}$'),
 tracking_hash text not null check(tracking_hash ~ '^[a-f0-9]{64}$'),
 purpose text not null check(purpose in ('initial','renewal')),
 price_cents integer not null check(price_cents between 100 and 999999),
 status text not null default 'pending' check(status in ('pending','confirmed','refunded','attention','cancelled','expired')),
 reserved_until timestamptz not null,
 payment_id text unique,
 provider_status text,
 provider_updated_at timestamptz,
 needs_attention boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists hm_reality_sponsor_orders_tracking_idx on public.hm_reality_sponsor_orders(code,tracking_hash);
create index if not exists hm_reality_sponsor_orders_sponsor_idx on public.hm_reality_sponsor_orders(sponsor_id,created_at desc);

create table if not exists public.hm_reality_sponsor_slots (
 slot_no smallint primary key check(slot_no between 1 and 50),
 active_sponsor_id uuid references public.hm_reality_sponsors(id),
 reserved_order_id uuid references public.hm_reality_sponsor_orders(id),
 reserved_until timestamptz,
 updated_at timestamptz not null default now()
);
insert into public.hm_reality_sponsor_slots(slot_no) select n from generate_series(1,50) n on conflict(slot_no) do nothing;

create table if not exists public.hm_reality_sponsor_payments (
 payment_id text primary key check(payment_id ~ '^[0-9]{1,40}$'),
 order_id uuid not null references public.hm_reality_sponsor_orders(id),
 sponsor_id uuid not null references public.hm_reality_sponsors(id),
 code text not null,
 amount_cents integer not null,
 provider_status text not null,
 provider_updated_at timestamptz not null,
 needs_attention boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.hm_reality_sponsor_notifications (
 id uuid primary key default gen_random_uuid(),
 sponsor_id uuid not null references public.hm_reality_sponsors(id),
 kind text not null check(kind='renewal_24h'),
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped')),
 sent_at timestamptz,
 error text not null default '',
 attempts integer not null default 0,
 claimed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(sponsor_id,kind,due_at)
);
alter table public.hm_reality_sponsor_notifications add column if not exists attempts integer not null default 0;
alter table public.hm_reality_sponsor_notifications add column if not exists claimed_at timestamptz;
alter table public.hm_reality_sponsor_notifications drop constraint if exists hm_reality_sponsor_notifications_status_check;
alter table public.hm_reality_sponsor_notifications add constraint hm_reality_sponsor_notifications_status_check check(status in ('pending','processing','sent','failed','skipped'));

alter table public.hm_reality_sponsor_settings enable row level security;
alter table public.hm_reality_sponsors enable row level security;
alter table public.hm_reality_sponsor_orders enable row level security;
alter table public.hm_reality_sponsor_slots enable row level security;
alter table public.hm_reality_sponsor_payments enable row level security;
alter table public.hm_reality_sponsor_notifications enable row level security;
revoke all on public.hm_reality_sponsor_settings,public.hm_reality_sponsors,public.hm_reality_sponsor_orders,public.hm_reality_sponsor_slots,public.hm_reality_sponsor_payments,public.hm_reality_sponsor_notifications from anon,authenticated;

create or replace function public.hm_reality_sponsor_expire_due()
returns integer language plpgsql security definer set search_path=''
as $$
declare n integer;
begin
 update public.hm_reality_sponsors set status='expired',updated_at=now() where status='active' and expires_at<=now();
 get diagnostics n=row_count;
 update public.hm_reality_sponsor_slots sl set active_sponsor_id=null,updated_at=now()
 where sl.active_sponsor_id is not null and not exists(select 1 from public.hm_reality_sponsors s where s.id=sl.active_sponsor_id and s.status='active' and s.expires_at>now());
 update public.hm_reality_sponsor_slots set reserved_order_id=null,reserved_until=null,updated_at=now() where reserved_order_id is not null and reserved_until<=now();
 update public.hm_reality_sponsor_orders set status='expired',updated_at=now() where status='pending' and reserved_until<=now();
 update public.hm_reality_sponsor_notifications set status='skipped',error='Patrocínio expirado.'
 where status in ('pending','failed','processing') and sponsor_id in(select id from public.hm_reality_sponsors where status='expired');
 return n;
end $$;

create or replace function public.hm_reality_sponsor_create(
 p_code text,p_tracking_hash text,p_type text,p_name text,p_username text,p_segment text,
 p_email text,p_phone text,p_logo_url text,p_device_hash text,p_price_cents integer,p_consent jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare cfg public.hm_reality_sponsor_settings; slot smallint; sid uuid; oid uuid; expiry timestamptz;
begin
 perform public.hm_reality_sponsor_expire_due();
 select * into cfg from public.hm_reality_sponsor_settings where id=1 for update;
 if not found or not cfg.enabled or cfg.price_cents<>p_price_cents then raise exception 'Patrocínio temporariamente indisponível.'; end if;
 if p_type not in ('person','company') or p_code !~ '^HC-RS-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$'
  or p_username !~ '^[A-Za-z0-9._]{3,24}$' or char_length(btrim(p_name)) not between 2 and 80
  or char_length(btrim(p_segment)) not between 2 and 60 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  or (p_device_hash is not null and p_device_hash !~ '^[a-f0-9]{64}$') then raise exception 'Confira os dados informados.'; end if;
 select slot_no into slot from public.hm_reality_sponsor_slots
 where active_sponsor_id is null and (reserved_order_id is null or reserved_until<=now())
 order by slot_no for update skip locked limit 1;
 if slot is null then raise exception 'As 50 vagas estão ocupadas. Consulte novamente mais tarde.'; end if;
 insert into public.hm_reality_sponsors(sponsor_type,display_name,username,segment,email,phone,logo_url,device_hash,consent,slot_no)
 values(p_type,btrim(p_name),btrim(p_username),btrim(p_segment),lower(btrim(p_email)),coalesce(p_phone,''),nullif(p_logo_url,''),p_device_hash,coalesce(p_consent,'{}'::jsonb),slot)
 returning id into sid;
 expiry:=now()+interval '10 minutes';
 insert into public.hm_reality_sponsor_orders(sponsor_id,code,tracking_hash,purpose,price_cents,reserved_until)
 values(sid,p_code,p_tracking_hash,'initial',p_price_cents,expiry) returning id into oid;
 update public.hm_reality_sponsor_slots set reserved_order_id=oid,reserved_until=expiry,updated_at=now() where slot_no=slot;
 return jsonb_build_object('sponsor_id',sid,'order_id',oid,'code',p_code,'slot_no',slot,'reserved_until',expiry);
end $$;

create or replace function public.hm_reality_sponsor_renew(
 p_sponsor_id uuid,p_tracking_hash text,p_code text,p_new_tracking_hash text,p_price_cents integer
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.hm_reality_sponsors; sl public.hm_reality_sponsor_slots; oid uuid; expiry timestamptz; cfg public.hm_reality_sponsor_settings;
begin
 perform public.hm_reality_sponsor_expire_due();
 select * into cfg from public.hm_reality_sponsor_settings where id=1;
 if not found or not cfg.enabled or cfg.price_cents<>p_price_cents then raise exception 'Renovações temporariamente indisponíveis.'; end if;
 if p_code !~ '^HC-RS-[A-F0-9]{12}$' or p_tracking_hash !~ '^[a-f0-9]{64}$' or p_new_tracking_hash !~ '^[a-f0-9]{64}$' then raise exception 'Identificação privada inválida.'; end if;
 select * into s from public.hm_reality_sponsors where id=p_sponsor_id for update;
 if not found then raise exception 'Este patrocínio não está disponível para renovação.'; end if;
 select * into sl from public.hm_reality_sponsor_slots where slot_no=s.slot_no for update;
 if sl.active_sponsor_id is not null and sl.active_sponsor_id<>s.id then raise exception 'Esta vaga foi ocupada. Não foi possível concluir a renovação. Entre em contato com a equipe HOCCO para receber suporte.'; end if;
 if sl.reserved_order_id is not null and sl.reserved_until>now() then
  if not exists(select 1 from public.hm_reality_sponsor_orders o where o.id=sl.reserved_order_id and o.sponsor_id=s.id and o.purpose='renewal') then
   raise exception 'Esta vaga foi ocupada. Não foi possível concluir a renovação. Entre em contato com a equipe HOCCO para receber suporte.';
  else raise exception 'Já existe uma reserva de renovação em andamento.'; end if;
 end if;
 if s.renewal_opt_out then raise exception 'Este patrocínio não está disponível para renovação.'; end if;
 if s.status='active' then
  if sl.active_sponsor_id is distinct from s.id then raise exception 'Esta vaga foi ocupada. Não foi possível concluir a renovação. Entre em contato com a equipe HOCCO para receber suporte.'; end if;
  if s.expires_at>now()+interval '24 hours' then raise exception 'A renovação será liberada 24 horas antes do fim do período.'; end if;
 elsif s.status='expired' then
  if sl.active_sponsor_id is not null then raise exception 'Esta vaga foi ocupada. Não foi possível concluir a renovação. Entre em contato com a equipe HOCCO para receber suporte.'; end if;
 else raise exception 'Este patrocínio não está disponível para renovação.';
 end if;
 if not exists(select 1 from public.hm_reality_sponsor_orders o where o.sponsor_id=s.id and o.tracking_hash=p_tracking_hash and o.purpose='initial' and o.status='confirmed') then raise exception 'Patrocínio não encontrado para renovação.'; end if;
 expiry:=now()+interval '10 minutes';
 insert into public.hm_reality_sponsor_orders(sponsor_id,code,tracking_hash,purpose,price_cents,reserved_until)
 values(s.id,p_code,p_new_tracking_hash,'renewal',p_price_cents,expiry) returning id into oid;
 update public.hm_reality_sponsor_slots set reserved_order_id=oid,reserved_until=expiry,updated_at=now() where slot_no=s.slot_no;
 return jsonb_build_object('order_id',oid,'code',p_code,'slot_no',s.slot_no,'reserved_until',expiry);
end $$;

create or replace function public.hm_reality_sponsor_apply_payment(
 p_code text,p_payment_id text,p_amount_cents integer,p_status text,p_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare o public.hm_reality_sponsor_orders; s public.hm_reality_sponsors; sl public.hm_reality_sponsor_slots; old public.hm_reality_sponsor_payments; bad boolean:=false;
begin
 if p_payment_id !~ '^[0-9]{1,40}$' or p_status not in ('approved','refunded','charged_back','in_mediation') or p_updated_at is null then raise exception 'Evento de pagamento inválido.'; end if;
 select * into o from public.hm_reality_sponsor_orders where code=p_code for update;
 if not found then raise exception 'Pedido de patrocínio não encontrado.'; end if;
 if o.price_cents<>p_amount_cents then raise exception 'Valor do pagamento divergente.'; end if;
 select * into old from public.hm_reality_sponsor_payments where payment_id=p_payment_id for update;
 if found and (old.order_id<>o.id or old.amount_cents<>p_amount_cents) then raise exception 'Pagamento já vinculado a outro pedido.'; end if;
 if found and old.provider_updated_at>p_updated_at then return jsonb_build_object('ignored',true); end if;
 select * into s from public.hm_reality_sponsors where id=o.sponsor_id for update;
 select * into sl from public.hm_reality_sponsor_slots where slot_no=s.slot_no for update;
 if p_status='approved' then
  if o.status='confirmed' and o.payment_id=p_payment_id then return jsonb_build_object('received',true,'duplicate',true); end if;
  if o.purpose='initial' then
   bad:=coalesce(sl.reserved_order_id<>o.id,true) or coalesce(sl.reserved_until<=now(),true) or sl.active_sponsor_id is not null;
   if not bad then
    update public.hm_reality_sponsors set status='active',starts_at=now(),expires_at=now()+interval '7 days',renewal_opt_out=false,renewal_notice_sent_at=null,updated_at=now() where id=s.id;
    update public.hm_reality_sponsor_slots set active_sponsor_id=s.id,reserved_order_id=null,reserved_until=null,updated_at=now() where slot_no=s.slot_no;
   end if;
  else
   bad:=coalesce(sl.reserved_order_id<>o.id,true) or coalesce(sl.reserved_until<=now(),true)
    or (s.status='active' and sl.active_sponsor_id is distinct from s.id)
    or (s.status='expired' and sl.active_sponsor_id is not null)
    or s.status not in ('active','expired');
   if not bad then
    if s.status='expired' then
     update public.hm_reality_sponsors set status='active',starts_at=now(),expires_at=now()+interval '7 days',renewal_opt_out=false,renewal_notice_sent_at=null,updated_at=now() where id=s.id;
    else
     update public.hm_reality_sponsors set expires_at=expires_at+interval '7 days',renewal_opt_out=false,renewal_notice_sent_at=null,updated_at=now() where id=s.id;
    end if;
    update public.hm_reality_sponsor_slots set active_sponsor_id=s.id,reserved_order_id=null,reserved_until=null,updated_at=now() where slot_no=s.slot_no;
   end if;
  end if;
  update public.hm_reality_sponsor_orders set status=case when bad then 'attention' else 'confirmed' end,payment_id=p_payment_id,provider_status=p_status,provider_updated_at=p_updated_at,needs_attention=bad,updated_at=now() where id=o.id;
  insert into public.hm_reality_sponsor_payments(payment_id,order_id,sponsor_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
  values(p_payment_id,o.id,s.id,o.code,p_amount_cents,p_status,p_updated_at,bad)
  on conflict(payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=excluded.needs_attention,updated_at=now();
  if bad then update public.hm_reality_sponsors set status=case when status='active' then status else 'attention' end,updated_at=now() where id=s.id; end if;
  return jsonb_build_object('received',true,'activated',not bad,'needs_attention',bad,'purpose',o.purpose);
 elsif p_status='refunded' then
  update public.hm_reality_sponsor_orders set status='refunded',payment_id=p_payment_id,provider_status=p_status,provider_updated_at=p_updated_at,updated_at=now() where id=o.id;
  if o.purpose='initial' then
   update public.hm_reality_sponsors set status='cancelled',updated_at=now() where id=s.id;
   update public.hm_reality_sponsor_slots set reserved_order_id=null,reserved_until=null,active_sponsor_id=case when active_sponsor_id=s.id then null else active_sponsor_id end,updated_at=now() where slot_no=s.slot_no;
  else
   update public.hm_reality_sponsors set expires_at=greatest(starts_at,expires_at-interval '7 days'),updated_at=now() where id=s.id;
  end if;
  insert into public.hm_reality_sponsor_payments(payment_id,order_id,sponsor_id,code,amount_cents,provider_status,provider_updated_at)
  values(p_payment_id,o.id,s.id,o.code,p_amount_cents,p_status,p_updated_at)
  on conflict(payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,updated_at=now();
  return jsonb_build_object('received',true,'refunded',true);
 else
  update public.hm_reality_sponsor_orders set status='attention',payment_id=p_payment_id,provider_status=p_status,provider_updated_at=p_updated_at,needs_attention=true,updated_at=now() where id=o.id;
  update public.hm_reality_sponsors set status='attention',updated_at=now() where id=s.id;
  update public.hm_reality_sponsor_slots set active_sponsor_id=case when active_sponsor_id=s.id then null else active_sponsor_id end,reserved_order_id=case when reserved_order_id=o.id then null else reserved_order_id end,reserved_until=case when reserved_order_id=o.id then null else reserved_until end,updated_at=now() where slot_no=s.slot_no;
  insert into public.hm_reality_sponsor_payments(payment_id,order_id,sponsor_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
  values(p_payment_id,o.id,s.id,o.code,p_amount_cents,p_status,p_updated_at,true)
  on conflict(payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=true,updated_at=now();
  return jsonb_build_object('received',true,'needs_attention',true);
 end if;
end $$;

create or replace function public.hm_reality_sponsor_optout(p_sponsor_id uuid,p_tracking_hash text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare s public.hm_reality_sponsors;
begin
 select * into s from public.hm_reality_sponsors where id=p_sponsor_id and exists(select 1 from public.hm_reality_sponsor_orders o where o.sponsor_id=p_sponsor_id and o.tracking_hash=p_tracking_hash and o.status='confirmed') for update;
 if not found then return false; end if;
 update public.hm_reality_sponsors set renewal_opt_out=true,updated_at=now() where id=p_sponsor_id;
 update public.hm_reality_sponsor_notifications set status='skipped',error='Patrocinador optou por não renovar.' where sponsor_id=p_sponsor_id and status in ('pending','failed','processing');
 return true;
end $$;

create or replace function public.hm_reality_sponsor_claim_due()
returns table(id uuid,sponsor_id uuid,display_name text,device_hash text,expires_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
 insert into public.hm_reality_sponsor_notifications(sponsor_id,kind,due_at)
 select s.id,'renewal_24h',date_trunc('minute',s.expires_at-interval '24 hours')
 from public.hm_reality_sponsors s
 where s.status='active' and s.renewal_opt_out=false and s.device_hash is not null
  and s.expires_at between now()+interval '22 hours' and now()+interval '24 hours'
 on conflict do nothing;
 return query
 with picked as (
  select n.id notification_id,s.id sponsor_id,s.display_name,s.device_hash,s.expires_at
  from public.hm_reality_sponsor_notifications n join public.hm_reality_sponsors s on s.id=n.sponsor_id
  where n.kind='renewal_24h' and n.status in ('pending','failed') and n.due_at<=now()
   and n.due_at=date_trunc('minute',s.expires_at-interval '24 hours')
   and s.status='active' and s.renewal_opt_out=false and s.expires_at>now()
  order by n.due_at for update of n skip locked limit 100
 )
 update public.hm_reality_sponsor_notifications n
 set status='processing',attempts=n.attempts+1,claimed_at=now(),error=''
 from picked where n.id=picked.notification_id
 returning n.id,picked.sponsor_id,picked.display_name,picked.device_hash,picked.expires_at;
end $$;

create or replace function public.hm_reality_sponsor_finish_notice(p_id uuid,p_sent boolean,p_error text default '')
returns boolean language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
 update public.hm_reality_sponsor_notifications
 set status=case when p_sent then 'sent' else 'failed' end,
  sent_at=case when p_sent then now() else null end,error=left(coalesce(p_error,''),300)
 where id=p_id and status='processing'
 returning sponsor_id into sid;
 if sid is null then return false; end if;
 if p_sent then update public.hm_reality_sponsors set renewal_notice_sent_at=now(),updated_at=now() where id=sid; end if;
 return true;
end $$;

revoke all on function public.hm_reality_sponsor_expire_due() from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_create(text,text,text,text,text,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_renew(uuid,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_apply_payment(text,text,integer,text,timestamptz) from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_optout(uuid,text) from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_claim_due() from public,anon,authenticated;
revoke all on function public.hm_reality_sponsor_finish_notice(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.hm_reality_sponsor_expire_due() to service_role;
grant execute on function public.hm_reality_sponsor_create(text,text,text,text,text,text,text,text,text,text,integer,jsonb) to service_role;
grant execute on function public.hm_reality_sponsor_renew(uuid,text,text,text,integer) to service_role;
grant execute on function public.hm_reality_sponsor_apply_payment(text,text,integer,text,timestamptz) to service_role;
grant execute on function public.hm_reality_sponsor_optout(uuid,text) to service_role;
grant execute on function public.hm_reality_sponsor_claim_due() to service_role;
grant execute on function public.hm_reality_sponsor_finish_notice(uuid,boolean,text) to service_role;
