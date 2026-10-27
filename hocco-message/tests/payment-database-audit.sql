-- Run exclusively in sandbox, within one transaction; the caller appends ROLLBACK.
-- Temporary fixture tables omit unrelated production columns/triggers.
-- The current production RPC is read-only copied to pg_temp before these assertions.
begin;
create temporary table hm_payments(provider_payment_id text primary key,kind text,order_id uuid,code text,amount_cents integer,provider_status text,provider_updated_at timestamptz,needs_attention boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
create temporary table hm_orders(id uuid primary key default gen_random_uuid(),code text unique,price_cents integer,payment text default 'pending',review text default 'approved',delivery text default 'pending',mercado_pago_payment_id text,payment_hold boolean default false,payment_claimed boolean default false,updated_at timestamptz default now());
create temporary table hm_sponsors(like pg_temp.hm_orders including all,starts_at timestamptz,expires_at timestamptz,next_thank_at timestamptz,next_expiry_notice_at timestamptz);
create temporary table hm_community_messages(like pg_temp.hm_orders including all,destination text default 'community',duration_hours integer default 4,published_at timestamptz,expires_at timestamptz,hidden_at timestamptz,live_status text,
 constraint synthetic_publish_guard check((published_at is null and expires_at is null) or (review='approved' and payment='confirmed' and published_at is not null and expires_at=published_at+make_interval(hours=>duration_hours))));
create temporary table hm_audit(order_id uuid,action text,detail jsonb);
create temporary table hm_community_audit(post_id uuid,action text,detail jsonb);
create temporary table hm_alex_events(event_type text,detail jsonb);
create temporary table audit_results(label text,passed boolean);
create function pg_temp.audit_assert(value boolean,label text) returns void language sql as $$insert into pg_temp.audit_results values(label,coalesce(value,false))$$;
-- INSERT_CURRENT_RPC_HERE
do $$
declare r jsonb; stamp timestamptz; deadline timestamptz; audit_count integer;
begin
 insert into pg_temp.hm_community_messages(code,price_cents) values('COMMUNITY',350),('HIDDEN',350),('REJECTED',350),('DIVERGENT',350),('OTHER',350);
 update pg_temp.hm_community_messages set hidden_at=now() where code='HIDDEN';
 update pg_temp.hm_community_messages set review='rejected' where code='REJECTED';
 insert into pg_temp.hm_community_messages(code,price_cents,destination,duration_hours) values('LIVE',550,'live',24);
 insert into pg_temp.hm_orders(code,price_cents) values('VIDEO',500),('DELIVERED',500);
 insert into pg_temp.hm_sponsors(code,price_cents,review) values('SPONSOR',6990,'pending');
 perform pg_temp.audit_assert((select bool_and(published_at is null) from pg_temp.hm_community_messages),'Unpaid messages have no publication');
 perform pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select payment='confirmed' and published_at is not null and expires_at-published_at=interval '4 hours' from pg_temp.hm_community_messages where code='COMMUNITY'),'Approved Community starts exactly four hours');
 select published_at,expires_at into stamp,deadline from pg_temp.hm_community_messages where code='COMMUNITY';
 select count(*) into audit_count from pg_temp.hm_community_audit;
 perform pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select published_at=stamp and expires_at=deadline from pg_temp.hm_community_messages where code='COMMUNITY'),'Repeated notification preserves publication and expiry');
 perform pg_temp.audit_assert((select count(*)=audit_count from pg_temp.hm_community_audit),'Repeated notification does not duplicate payment audit');
 r:=pg_temp.hm_apply_verified_payment('community','COMMUNITY','900002',350,'approved','2026-10-27 12:01Z');
 perform pg_temp.audit_assert((r->>'duplicate_payment')::boolean and (select needs_attention from pg_temp.hm_payments where provider_payment_id='900002'),'Second payment is flagged for attention');
 perform pg_temp.audit_assert((select mercado_pago_payment_id='900001' and expires_at=deadline from pg_temp.hm_community_messages where code='COMMUNITY'),'Second payment cannot replace transaction or extend exposure');
 perform pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'in_mediation','2026-10-27 12:02Z');
 perform pg_temp.audit_assert((select payment_hold from pg_temp.hm_community_messages where code='COMMUNITY'),'Dispute applies financial hold');
 r:=pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((r->>'ignored')::boolean and (select payment_hold from pg_temp.hm_community_messages where code='COMMUNITY'),'Older approval cannot clear newer dispute');
 perform pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'refunded','2026-10-27 12:03Z');
 perform pg_temp.audit_assert((select payment='refunded' and published_at is null and expires_at is null from pg_temp.hm_community_messages where code='COMMUNITY'),'Community refund clears public exposure');
 perform pg_temp.hm_apply_verified_payment('community','COMMUNITY','900001',350,'approved','2026-10-27 12:04Z');
 perform pg_temp.audit_assert((select payment='refunded' and published_at is null from pg_temp.hm_community_messages where code='COMMUNITY'),'Later approval does not republish refunded message');
 perform pg_temp.hm_apply_verified_payment('community','LIVE','900003',550,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select payment='confirmed' and live_status='queued' and expires_at-published_at=interval '24 hours' from pg_temp.hm_community_messages where code='LIVE'),'Paid LIVE enters queue with 24-hour feed duration');
 perform pg_temp.hm_apply_verified_payment('order','VIDEO','900004',500,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select payment='confirmed' and delivery='pending' from pg_temp.hm_orders where code='VIDEO'),'Video payment does not claim delivery');
 perform pg_temp.hm_apply_verified_payment('order','VIDEO','900004',500,'refunded','2026-10-27 12:01Z');
 perform pg_temp.audit_assert((select payment='refunded' and delivery='pending' from pg_temp.hm_orders where code='VIDEO'),'Undelivered video refund preserves delivery state');
 perform pg_temp.hm_apply_verified_payment('order','DELIVERED','900005',500,'approved','2026-10-27 12:00Z');
 update pg_temp.hm_orders set delivery='published' where code='DELIVERED';
 perform pg_temp.hm_apply_verified_payment('order','DELIVERED','900005',500,'refunded','2026-10-27 12:01Z');
 perform pg_temp.audit_assert((select delivery='published' and payment_hold from pg_temp.hm_orders where code='DELIVERED') and (select provider_status='refunded' from pg_temp.hm_payments where provider_payment_id='900005'),'Delivered video retains delivery evidence and refund ledger');
 perform pg_temp.hm_apply_verified_payment('sponsor','SPONSOR','900006',6990,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select payment='confirmed' and review='pending' and starts_at is null from pg_temp.hm_sponsors where code='SPONSOR'),'Sponsor payment awaits human curation without exposure');
 update pg_temp.hm_sponsors set review='approved',starts_at=now(),expires_at=now()+interval '7 days' where code='SPONSOR';
 perform pg_temp.hm_apply_verified_payment('sponsor','SPONSOR','900006',6990,'refunded','2026-10-27 12:01Z');
 perform pg_temp.audit_assert((select payment='refunded' and starts_at is null and expires_at is null from pg_temp.hm_sponsors where code='SPONSOR'),'Sponsor refund removes active period');
 perform pg_temp.hm_apply_verified_payment('community','HIDDEN','900007',350,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select payment='confirmed' and published_at is null from pg_temp.hm_community_messages where code='HIDDEN'),'Payment cannot republish hidden content');
 perform pg_temp.hm_apply_verified_payment('community','REJECTED','900008',350,'approved','2026-10-27 12:00Z');
 perform pg_temp.audit_assert((select published_at is null from pg_temp.hm_community_messages where code='REJECTED') and (select needs_attention from pg_temp.hm_payments where provider_payment_id='900008'),'Rejected paid content remains hidden and flagged');
 begin
  perform pg_temp.hm_apply_verified_payment('community','DIVERGENT','900009',1,'approved','2026-10-27 12:00Z');
  perform pg_temp.audit_assert(false,'Wrong amount rejected');
 exception when others then perform pg_temp.audit_assert(SQLERRM='Valor divergente.','Wrong amount rejected');end;
 begin
  perform pg_temp.hm_apply_verified_payment('community','OTHER','900003',350,'approved','2026-10-27 12:00Z');
  perform pg_temp.audit_assert(false,'Payment cannot be reused for another order');
 exception when others then perform pg_temp.audit_assert(SQLERRM='Pagamento já vinculado a outro pedido.','Payment cannot be reused for another order');end;
 begin
  perform pg_temp.hm_apply_verified_payment('community','DIVERGENT','900009',350,'pending','2026-10-27 12:00Z');
  perform pg_temp.audit_assert(false,'Pending provider event cannot confirm');
 exception when others then perform pg_temp.audit_assert(SQLERRM='Evento de pagamento inválido.','Pending provider event cannot confirm');end;
 begin
  update pg_temp.hm_community_messages set published_at=now(),expires_at=now()+interval '4 hours' where code='DIVERGENT';
  perform pg_temp.audit_assert(false,'Publication without payment fails database guard');
 exception when check_violation then perform pg_temp.audit_assert(true,'Publication without payment fails database guard');end;
 perform pg_temp.audit_assert((select payment='pending' and published_at is null from pg_temp.hm_community_messages where code='DIVERGENT'),'Rejected writes leave original pending record intact');
end $$;
select jsonb_agg(to_jsonb(t)) as results from pg_temp.audit_results t;
rollback;
