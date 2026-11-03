begin;
do $$
declare v smallint;h text:=repeat('b',64);other text:=repeat('c',64);batch jsonb;d jsonb;i integer;cfg public.hm_settings;purchase jsonb;
begin
 select vapid_version into v from public.hocco_push_config where id=true;
 perform public.hm_push_register(h,'{"endpoint":"https://fcm.googleapis.com/fcm/send/rollback-only","keys":{"p256dh":"test","auth":"test"}}',v);
 if jsonb_array_length(public.hm_push_claim(1))<>0 then raise exception 'Before48h';end if;
 perform public.hm_push_activity(h,true,false,null);
 for i in 1..3 loop
  update public.hm_push_devices set last_activity_at=now()-interval '8 days',next_send_at=now()-interval '8 days' where device_hash=h;
  batch:=public.hm_push_claim(1);d:=batch->0;
  if jsonb_array_length(batch)<>1 or d->>'variant'<>(case when i=1 then 'abandoned' else i::text end) then raise exception 'Wrong sequence';end if;
  perform public.hm_push_finish(h,(d->>'dispatchId')::uuid,true,false,'');
  if jsonb_array_length(public.hm_push_claim(1))<>0 then raise exception 'Backlog replay';end if;
  if (select next_send_at<>now()+(case when i=3 then interval '14 days' else interval '48 hours' end) from public.hm_push_devices where device_hash=h) then raise exception 'Wrong interval';end if;
 end loop;
 perform public.hm_push_read(other,(d->>'notificationId')::uuid);
 if (select read_at is not null from public.hm_push_inbox where id=(d->>'notificationId')::uuid) then raise exception 'Ownership bypass';end if;
 perform public.hm_push_activity(h,false,false,(d->>'notificationId')::uuid);
 if (select cycle_count<>0 or return_count<>1 from public.hm_push_devices where device_hash=h) then raise exception 'No return reset';end if;
 for i in 1..3 loop
  update public.hm_push_devices set last_activity_at=now()-interval '8 days',next_send_at=now()-interval '8 days' where device_hash=h;
  d:=public.hm_push_claim(1)->0;perform public.hm_push_finish(h,(d->>'dispatchId')::uuid,false,false,'test');
 end loop;
 if (select next_send_at is not null or failure_count<>3 from public.hm_push_devices where device_hash=h) then raise exception 'Failures not paused';end if;
 perform public.hm_push_register(h,'{"endpoint":"https://fcm.googleapis.com/fcm/send/rollback-only","keys":{"p256dh":"test","auth":"test"}}',v);
 update public.hm_push_devices set last_activity_at=now()-interval '49 hours',next_send_at=now()-interval '1 minute' where device_hash=h;
 d:=public.hm_push_claim(1)->0;perform public.hm_push_activity(h,false,true,null);
 if public.hm_push_dispatch_valid(h,(d->>'dispatchId')::uuid) then raise exception 'Optout ignored';end if;
 perform public.hm_push_activity(h,false,false,null);
 if (select enabled from public.hm_push_devices where device_hash=h) then raise exception 'Activity re-enabled disabled device';end if;
 select * into cfg from public.hm_settings where id=1;
 purchase:=public.hm_create_identified_message('community',jsonb_build_object('code','HC-CM-FFEE00112233','tracking_hash',repeat('e',64),'name','Teste','username','teste_push','avatar',1,'message','Teste transacional push','destination','community','requires_review',false,'expected_price',cfg.community_price_cents,'legal_version','2026-11-03.v13','terms',true),jsonb_build_object('fullName','Teste Interno','phone','5511999999999','ip','203.0.113.7'));
 perform public.hm_push_bind_purchase(h,'community',purchase->>'code');
 update public.hm_push_devices set last_return_at=now()-interval '1 day' where device_hash=h;
 update public.hm_community_messages set payment='confirmed' where code=purchase->>'code';
 update public.hm_community_messages set payment='refunded' where code=purchase->>'code';
 update public.hm_community_messages set payment='confirmed' where code=purchase->>'code';
 if (select conversion_count<>1 from public.hm_push_devices where device_hash=h) then raise exception 'Duplicate conversion';end if;
 if (select count(*)<>1 from public.hm_reactivation_events where phone_hash=h and event='converted' and variant='push') then raise exception 'Duplicate conversion event';end if;
 if has_table_privilege('anon','public.hm_push_devices','select') or has_function_privilege('authenticated','public.hm_push_claim(integer)','execute') then raise exception 'Private grants exposed';end if;
end $$;
select 'PASS: app push cadence, ownership, reset, pause, optout, conversion idempotence and private grants' as result;
rollback;
