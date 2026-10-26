-- Additive financial ledger. All writes are service-only and atomic with delivery changes.
create table public.hm_payments (
 provider_payment_id text primary key check (provider_payment_id ~ '^[0-9]{1,40}$'),
 kind text not null check(kind in ('order','community','sponsor')),
 order_id uuid not null,
 code text not null,
 amount_cents integer not null check(amount_cents between 1 and 999999),
 provider_status text not null,
 provider_updated_at timestamptz not null,
 needs_attention boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index hm_payments_order_idx on public.hm_payments(kind,order_id);
alter table public.hm_payments enable row level security;
revoke all on public.hm_payments from public,anon,authenticated;
grant select,insert,update on public.hm_payments to service_role;
alter table public.hm_orders add column mercado_pago_payment_id text, add column payment_hold boolean not null default false;
alter table public.hm_sponsors add column mercado_pago_payment_id text, add column payment_hold boolean not null default false;
alter table public.hm_community_messages add column payment_hold boolean not null default false, add column duration_hours smallint not null default 4 check(duration_hours between 1 and 24);
alter table public.hm_community_messages drop constraint hm_community_publish_guard;
alter table public.hm_community_messages add constraint hm_community_publish_guard check (
 (published_at is null and expires_at is null) or
 (review='approved' and payment='confirmed' and published_at is not null and expires_at=published_at+make_interval(hours=>duration_hours))
);
create function public.hm_set_message_duration() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.destination='live' then new.duration_hours:=24;
 else select community_duration_hours into new.duration_hours from public.hm_settings where id=1;
 end if;
 new.duration_hours:=coalesce(new.duration_hours,4);return new;
end $$;
revoke all on function public.hm_set_message_duration() from public,anon,authenticated;
create trigger hm_message_duration before insert on public.hm_community_messages for each row execute function public.hm_set_message_duration();

create function public.hm_apply_verified_payment(p_kind text,p_code text,p_payment_id text,p_amount_cents integer,p_status text,p_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tbl text; item jsonb; previous public.hm_payments; existing_id text; disputed boolean; stamp timestamptz:=now();
begin
 if p_kind not in ('order','community','sponsor') or p_payment_id !~ '^[0-9]{1,40}$' or p_status not in ('approved','refunded','charged_back','in_mediation') or p_updated_at is null then raise exception 'Evento de pagamento inválido.'; end if;
 tbl:=case p_kind when 'order' then 'hm_orders' when 'community' then 'hm_community_messages' else 'hm_sponsors' end;
 execute format('select to_jsonb(t) from public.%I t where code=$1 for update',tbl) into item using p_code;
 if item is null then raise exception 'Pedido não encontrado.'; end if;
 if (item->>'price_cents')::integer<>p_amount_cents then raise exception 'Valor divergente.'; end if;
 select * into previous from public.hm_payments where provider_payment_id=p_payment_id for update;
 if found then
  if previous.kind<>p_kind or previous.order_id<>(item->>'id')::uuid then raise exception 'Pagamento já vinculado a outro pedido.'; end if;
  if previous.provider_updated_at>p_updated_at then return jsonb_build_object('ignored',true); end if;
 end if;
 existing_id:=item->>'mercado_pago_payment_id';
 if existing_id is not null and existing_id<>p_payment_id then
  insert into public.hm_payments(provider_payment_id,kind,order_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
  values(p_payment_id,p_kind,(item->>'id')::uuid,p_code,p_amount_cents,p_status,p_updated_at,true)
  on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=true,updated_at=now();
  return jsonb_build_object('duplicate_payment',true,'needs_attention',true);
 end if;
 disputed:=p_status in ('charged_back','in_mediation');
 insert into public.hm_payments(provider_payment_id,kind,order_id,code,amount_cents,provider_status,provider_updated_at,needs_attention)
 values(p_payment_id,p_kind,(item->>'id')::uuid,p_code,p_amount_cents,p_status,p_updated_at,disputed or (p_status='approved' and item->>'review'='rejected'))
 on conflict(provider_payment_id) do update set provider_status=excluded.provider_status,provider_updated_at=excluded.provider_updated_at,needs_attention=excluded.needs_attention,updated_at=now();
 if p_status='approved' and item->>'payment'='pending' then
  execute format('update public.%I set payment=''confirmed'',mercado_pago_payment_id=$1,payment_claimed=false,updated_at=now() where id=$2',tbl) using p_payment_id,(item->>'id')::uuid;
  if p_kind='order' then insert into public.hm_audit(order_id,action,detail) values((item->>'id')::uuid,'pay',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id));
  elsif p_kind='sponsor' then insert into public.hm_alex_events(event_type,detail) values('system_event',jsonb_build_object('object','sponsor','action','payment_confirmed','sponsor_id',item->>'id','code',p_code,'payment_id',p_payment_id));
  else insert into public.hm_community_audit(post_id,action,detail) values((item->>'id')::uuid,'payment_confirmed',jsonb_build_object('source','mercado_pago','payment_id',p_payment_id)); end if;
 end if;
 if p_status='approved' then
  -- Never republish a refund, a rejection, or a second payment. Sponsor activation remains human-curated.
  execute format('update public.%I set mercado_pago_payment_id=$1,payment_hold=false where id=$2 and payment=''confirmed''',tbl) using p_payment_id,(item->>'id')::uuid;
  if p_kind='community' then
   update public.hm_community_messages set published_at=stamp,expires_at=stamp+make_interval(hours=>duration_hours),
    live_status=case when destination='live' then coalesce(live_status,'queued') else live_status end,updated_at=stamp
   where id=(item->>'id')::uuid and payment='confirmed' and review='approved' and published_at is null and hidden_at is null;
  end if;
 elsif p_status='refunded' then
  if p_kind='community' then update public.hm_community_messages set payment='refunded',published_at=null,expires_at=null,live_status=null,payment_hold=false,mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  elsif p_kind='sponsor' then update public.hm_sponsors set payment='refunded',starts_at=null,expires_at=null,next_thank_at=null,next_expiry_notice_at=null,payment_hold=false,mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  else
   -- A previously delivered video cannot be un-delivered; retain that fact and record its refund in the ledger.
   update public.hm_orders set payment=case when delivery='published' then payment else 'refunded' end,payment_hold=(delivery='published'),mercado_pago_payment_id=p_payment_id,updated_at=stamp where id=(item->>'id')::uuid;
  end if;
 else
  execute format('update public.%I set payment_hold=true,mercado_pago_payment_id=$1,updated_at=now() where id=$2',tbl) using p_payment_id,(item->>'id')::uuid;
 end if;
 return jsonb_build_object('received',true,'updated',true);
end $$;
revoke all on function public.hm_apply_verified_payment(text,text,text,integer,text,timestamptz) from public,anon,authenticated;
grant execute on function public.hm_apply_verified_payment(text,text,text,integer,text,timestamptz) to service_role;

create or replace function public.hm_community_admin_action(p_actor uuid,p_id uuid,p_action text,p_payload jsonb default '{}'::jsonb)
returns public.hm_community_messages language plpgsql security invoker set search_path='' as $$
declare m public.hm_community_messages; reason text:=trim(coalesce(p_payload->>'reason',''));
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
 select * into m from public.hm_community_messages where id=p_id for update;
 if not found then raise exception 'Mensagem da comunidade não encontrada.'; end if;
 case p_action
 when 'approve' then if m.review<>'pending' or m.payment_hold then raise exception 'A curadoria não está disponível.'; end if; m.review:='approved';
 when 'reject' then if m.review<>'pending' or char_length(reason) not between 2 and 500 then raise exception 'Informe o motivo da recusa.'; end if; m.review:='rejected';m.reason:=reason;
 when 'refund' then if m.review<>'rejected' or m.payment<>'confirmed' then raise exception 'Não há devolução pendente.'; end if; m.payment:='refunded';m.published_at:=null;m.expires_at:=null;m.live_status:=null;
 when 'live_read' then if m.destination<>'live' or m.payment<>'confirmed' or m.review<>'approved' or m.payment_hold or m.live_status is distinct from 'queued' then raise exception 'Esta mensagem não está na fila da LIVE.'; end if; m.live_status:='read';
 else raise exception 'Ação de curadoria inválida.';
 end case;
 if m.review='approved' and m.payment='confirmed' and not m.payment_hold then
  if m.published_at is null then m.published_at:=now();m.expires_at:=m.published_at+make_interval(hours=>m.duration_hours);end if;
  if m.destination='live' and m.live_status is null then m.live_status:='queued';end if;
 end if;
 update public.hm_community_messages set review=m.review,payment=m.payment,reason=m.reason,published_at=m.published_at,expires_at=m.expires_at,live_status=m.live_status,updated_at=now() where id=m.id returning * into m;
 insert into public.hm_community_audit(post_id,actor_id,action,detail) values(m.id,p_actor,p_action,jsonb_build_object('reason',reason,'destination',m.destination));
 return m;
end $$;
revoke all on function public.hm_community_admin_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.hm_community_admin_action(uuid,uuid,text,jsonb) to service_role;
