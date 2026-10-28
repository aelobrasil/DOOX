begin;
create table public.hm_asset_cleanup_queue (
 path text primary key check (path ~ '^sponsors/[a-f0-9]{32}-(logo|cover)\.(png|jpg|webp)$'),
 created_at timestamptz not null default now()
);
alter table public.hm_asset_cleanup_queue enable row level security;
revoke all on public.hm_asset_cleanup_queue from public,anon,authenticated;
grant all on public.hm_asset_cleanup_queue to service_role;
create or replace function public.hm_cleanup_records(p_actor uuid,p_scope text,p_ids uuid[],p_execute boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record; kind text; eligible integer:=0; protected integer:=0; files integer:=0; safe boolean; path text; removed integer:=0;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
 if p_scope not in ('orders','sponsors','community','live','trash','reports','visits') then raise exception 'Área de limpeza inválida.'; end if;
 if coalesce(cardinality(p_ids),0)>1000 then raise exception 'Selecione até 1000 registros por vez.'; end if;
 -- Serializes cleanup requests; ordinary purchase/payment transactions remain independent.
 perform pg_advisory_xact_lock(730491224);
 if p_scope in ('reports','visits') then
  if p_scope='reports' then
   select count(*) into eligible from public.hm_alex_reports where generated_at<now()-interval '30 days';
   if p_execute then delete from public.hm_alex_reports where generated_at<now()-interval '30 days'; get diagnostics removed=row_count; end if;
  else
   select count(*) into eligible from public.hm_alex_events where event_type='site_view' and created_at<now()-interval '30 days';
   if p_execute then delete from public.hm_alex_events where event_type='site_view' and created_at<now()-interval '30 days'; get diagnostics removed=row_count; end if;
  end if;
 else
  for kind in select unnest(case p_scope when 'trash' then array['order','sponsor'] when 'orders' then array['order'] when 'sponsors' then array['sponsor'] else array['community'] end) loop
   for r in
    select id,to_jsonb(o) as item from public.hm_orders o where kind='order' and o.id=any(coalesce(p_ids,'{}')) and not o.is_demo for update
   loop
    safe:=r.item->>'archived_at' is not null and r.item->>'payment' not in ('confirmed','refunded') and coalesce(r.item->>'mercado_pago_payment_id','')='' and not coalesce((r.item->>'payment_claimed')::boolean,false) and not coalesce((r.item->>'payment_hold')::boolean,false) and r.item->>'delivery'<>'published';
    safe:=safe and not exists(select 1 from public.hm_payments p where p.order_id=r.id or (p.code=r.item->>'code' and p.kind='order')) and not exists(select 1 from public.hm_reconciliation_jobs j where j.code=r.item->>'code' and j.kind='order');
    if safe then eligible:=eligible+1;if p_execute then delete from public.hm_audit where order_id=r.id;delete from public.hm_orders where id=r.id;removed:=removed+1;end if;else protected:=protected+1;end if;
   end loop;
   for r in select id,to_jsonb(s) as item from public.hm_sponsors s where kind='sponsor' and s.id=any(coalesce(p_ids,'{}')) for update loop
    safe:=r.item->>'archived_at' is not null and r.item->>'payment' not in ('confirmed','refunded') and coalesce(r.item->>'mercado_pago_payment_id','')='' and not coalesce((r.item->>'payment_claimed')::boolean,false) and not coalesce((r.item->>'payment_hold')::boolean,false);
    safe:=safe and not exists(select 1 from public.hm_payments p where p.order_id=r.id or (p.code=r.item->>'code' and p.kind='sponsor')) and not exists(select 1 from public.hm_reconciliation_jobs j where j.code=r.item->>'code' and j.kind='sponsor');
    if safe then
     -- Only app-owned Storage paths. Never delete arbitrary URLs or shared files here.
     foreach path in array array[substring(r.item->>'logo_url' from '/public/hocco-sponsor-logos/(sponsors/[a-f0-9]{32}-(?:logo|cover)\.(?:png|jpg|webp))$'),substring(r.item->>'cover_url' from '/public/hocco-sponsor-logos/(sponsors/[a-f0-9]{32}-(?:logo|cover)\.(?:png|jpg|webp))$')] loop
      if path is not null then files:=files+1;if p_execute then insert into public.hm_asset_cleanup_queue(path) values(path) on conflict do nothing;end if;end if;
     end loop;
     eligible:=eligible+1;if p_execute then delete from public.hm_sponsors where id=r.id;removed:=removed+1;end if;
    else protected:=protected+1;end if;
   end loop;
   for r in select id,to_jsonb(c) as item from public.hm_community_messages c where kind='community' and c.id=any(coalesce(p_ids,'{}')) and ((p_scope='live' and c.destination='live') or (p_scope='community' and c.destination='community')) for update loop
    safe:=r.item->>'payment' not in ('confirmed','refunded') and coalesce(r.item->>'mercado_pago_payment_id','')='' and not coalesce((r.item->>'payment_claimed')::boolean,false) and not coalesce((r.item->>'payment_hold')::boolean,false) and r.item->>'published_at' is null;
    safe:=safe and not exists(select 1 from public.hm_payments p where p.order_id=r.id or (p.code=r.item->>'code' and p.kind='community')) and not exists(select 1 from public.hm_reconciliation_jobs j where j.code=r.item->>'code' and j.kind='community');
    if safe then eligible:=eligible+1;if p_execute then delete from public.hm_community_audit where post_id=r.id;delete from public.hm_community_messages where id=r.id;removed:=removed+1;end if;else protected:=protected+1;end if;
   end loop;
  end loop;
 end if;
 if p_execute then insert into public.hm_alex_events(event_type,severity,detail) values('system_event','info',jsonb_build_object('object','administrative_cleanup','actor_id',p_actor,'scope',p_scope,'removed',removed,'protected',protected));end if;
 return jsonb_build_object('eligible',eligible,'protected',protected,'files',files,'removed',removed,'executed',p_execute);
end;
$$;
revoke all on function public.hm_cleanup_records(uuid,text,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.hm_cleanup_records(uuid,text,uuid[],boolean) to service_role;
commit;
