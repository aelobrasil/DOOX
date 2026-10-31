-- Real Postgres functions; all fixture data and side effects are rolled back.
begin;
create temporary table expiry_release_checks(label text,passed boolean);
do $checks$
declare
 pending_id uuid:=gen_random_uuid(); paid_id uuid:=gen_random_uuid(); live_id uuid:=gen_random_uuid();
 pending_code text:='HC-CM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12));
 paid_code text:='HC-CM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12));
 live_code text:='HC-CM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12));
 h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 pid text:='999'||extract(epoch from clock_timestamp())::bigint::text;
 cfg public.hm_settings; fresh_order public.hm_orders; retry_order public.hm_orders; fresh_post public.hm_community_messages; newhash text; result jsonb; stamp timestamptz:=now(); failed boolean;
begin
 insert into public.hm_community_messages(id,code,tracking_hash,member_name,member_username,avatar_index,message,price_cents,payment,review,created_at)
 values(pending_id,pending_code,h,'Teste isolado','teste_expiry',1,'Conteúdo que deve ser apagado.',350,'pending','approved',now()-interval '21 minutes');
 insert into public.hm_community_messages(id,code,tracking_hash,member_name,member_username,avatar_index,message,price_cents,payment,review,created_at)
 values(paid_id,paid_code,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'Teste isolado','teste_paid',1,'Conteúdo pago que deve ser preservado.',350,'confirmed','approved',now()-interval '21 minutes');
 perform public.hm_expire_unpaid_comments();
 insert into expiry_release_checks values('unpaid content deleted after twenty minutes',not exists(select 1 from public.hm_community_messages where id=pending_id));
 insert into expiry_release_checks values('paid content preserved',exists(select 1 from public.hm_community_messages where id=paid_id));
 insert into expiry_release_checks values('minimal financial identity retained without content',exists(select 1 from public.hm_expired_purchases where kind='community' and code=pending_code and tracking_hash=h));
 result:=public.hm_apply_verified_payment('community',pending_code,pid,350,'approved',stamp);
 insert into expiry_release_checks values('late payment requires attention',coalesce((result->>'needs_attention')::boolean,false) and exists(select 1 from public.hm_payments where provider_payment_id=pid and needs_attention));
 insert into expiry_release_checks values('late payment never recreates the deleted message',not exists(select 1 from public.hm_community_messages where id=pending_id));
 perform public.hm_apply_verified_payment('community',pending_code,pid,350,'refunded',stamp+interval '1 minute');
 perform public.hm_apply_verified_payment('community',pending_code,pid,350,'approved',stamp);
 insert into expiry_release_checks values('stale approval cannot undo a later refund',exists(select 1 from public.hm_payments where provider_payment_id=pid and provider_status='refunded' and not needs_attention));
 insert into public.hm_community_messages(id,code,tracking_hash,member_name,member_username,avatar_index,message,price_cents,payment,review,published_at,expires_at)
 values(live_id,live_code,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'Teste isolado','teste_live',1,'Mensagem pública que pode receber curtidas.',350,'confirmed','approved',stamp,stamp+interval '4 hours');
 update public.hm_community_messages set destination='live',live_status='queued',live_scheduled_at=stamp+interval '1 day' where id=live_id;
 result:=public.hm_community_set_like(live_id,repeat('b',64),true);
 insert into expiry_release_checks values('visible LIVE post accepts a genuine like',(result->>'likesCount')::integer=1);
 update public.hm_community_messages set hidden_at=stamp where id=live_id;
 failed:=false;begin perform public.hm_community_set_like(live_id,repeat('c',64),true);exception when others then failed:=true;end;
 insert into expiry_release_checks values('hidden post rejects likes',failed);
 update public.hm_community_messages set hidden_at=null,payment_hold=true where id=live_id;
 failed:=false;begin perform public.hm_community_set_like(live_id,repeat('c',64),true);exception when others then failed:=true;end;
 insert into expiry_release_checks values('financial hold rejects likes',failed);
 select * into cfg from public.hm_settings where id=1;
 newhash:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 fresh_order:=public.hm_create_order('HM-26-'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),newhash,'Teste isolado','Pedido de vídeo isolado.','',false,false,'instagram','teste_expiry',1,'2026-10-31.v12',(cfg.prices->>0)::integer,cfg.version);
 retry_order:=public.hm_create_order('HM-26-'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),newhash,'Teste isolado','Pedido de vídeo isolado.','',false,false,'instagram','teste_expiry',1,'2026-10-31.v12',(cfg.prices->>0)::integer,cfg.version);
 insert into expiry_release_checks values('video retry returns the same order',fresh_order.id=retry_order.id);
 fresh_post:=public.hm_create_community_purchase(jsonb_build_object('code','HC-CM-'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),'tracking_hash',md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'name','Teste isolado','username','teste_expiry','avatar',1,'message','Novo pedido de comunidade isolado.','destination','community','requires_review',false,'expected_price',cfg.community_price_cents,'legal_version','2026-10-31.v12','terms',true));
 perform public.hm_expire_unpaid_comments();
 insert into expiry_release_checks values('fresh unpaid orders keep their twenty-minute window',exists(select 1 from public.hm_orders where id=fresh_order.id) and exists(select 1 from public.hm_community_messages where id=fresh_post.id));
 failed:=false;begin perform public.hm_create_community_purchase(jsonb_build_object('tracking_hash',h));exception when others then failed:=sqlerrm like '%20 minutos%';end;
 insert into expiry_release_checks values('an expired request identity cannot silently create another order',failed);
 insert into expiry_release_checks values('anonymous cannot read expired references',not has_table_privilege('anon','public.hm_expired_purchases','select'));
 insert into expiry_release_checks values('anonymous cannot execute cleanup',not has_function_privilege('anon','public.hm_expire_unpaid_comments()','execute'));
 if exists(select 1 from expiry_release_checks where not passed or passed is null) then raise exception 'Expiry release checks failed: %',(select jsonb_agg(label) from expiry_release_checks where not passed or passed is null);end if;
end $checks$;
select jsonb_agg(to_jsonb(expiry_release_checks)) as checks from expiry_release_checks;
rollback;
