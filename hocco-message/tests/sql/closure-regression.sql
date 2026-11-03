begin;
do $$
declare cfg public.hm_settings;v jsonb;q jsonb;d jsonb;actor uuid;stamp timestamptz;sid uuid;
begin
select * into cfg from public.hm_settings where id=1;select user_id into actor from public.hm_team_members where active limit 1;
v:=public.hm_create_identified_message('community',jsonb_build_object('code','HC-CM-FFFF00001111','tracking_hash',repeat('e',64),'name','Teste interno','username','teste_interno','avatar',1,'message','Teste transacional de retenção','destination','community','requires_review',false,'expected_price',cfg.community_price_cents,'legal_version','2026-11-03.v13','terms',true),jsonb_build_object('fullName','Pessoa Teste Interno','phone','5511999999999','ip','203.0.113.8'));
update public.hm_sender_evidence set recorded_at=now()-interval '10 minutes',expires_at=now()+interval '47 hours 50 minutes' where code=v->>'code';q:=public.hm_list_sender_evidence(actor,'FFFF00001111',0);if (q->>'total')::int<>0 then raise exception 'Unpaid exposed';end if;
update public.hm_community_messages set payment='confirmed' where code=v->>'code';select confirmed_at into stamp from public.hm_sender_evidence where code=v->>'code';if stamp is null then raise exception 'Payment clock missing';end if;
q:=public.hm_list_sender_evidence(actor,'FFFF00001111',0);if (q->>'total')::int<>1 or q#>>'{items,0,purchase,message}'<>'Teste transacional de retenção' then raise exception 'Queue snapshot failed';end if;
update public.hm_community_messages set message='[removido]',content_removed_at=now() where code=v->>'code';if (public.hm_list_sender_evidence(actor,'FFFF00001111',0)#>>'{items,0,purchase,message}')<>'Teste transacional de retenção' then raise exception 'Snapshot lost';end if;
update public.hm_community_messages set payment='confirmed' where code=v->>'code';if (select confirmed_at<>stamp from public.hm_sender_evidence where code=v->>'code') then raise exception 'Retention extended';end if;
perform public.hm_register_reactivation(repeat('e',64),'5511999999999','Teste','community',v->>'code');update public.hm_reminder_subscriptions set last_activity_at=now()-interval '49 hours',next_send_at=now()-interval '1 minute' where activity_hash=repeat('e',64);
d:=public.hm_claim_reactivation(1);if jsonb_array_length(d)<>1 or d#>>'{0,variant}'<>'participant' then raise exception 'Claim failed';end if;
perform public.hm_finish_reactivation(repeat('e',64),(d#>>'{0,dispatchId}')::uuid,true,'{}');if jsonb_array_length(public.hm_claim_reactivation(1))<>0 then raise exception 'Duplicate dispatch';end if;
perform public.hm_reactivation_activity(array[repeat('e',64)],false);if (select cycle_count<>0 or return_count<>1 or next_send_at<now()+interval '48 hours' from public.hm_reminder_subscriptions where activity_hash=repeat('e',64)) then raise exception 'Return reset failed';end if;
perform public.hm_reactivation_activity(array[repeat('e',64)],true);if (select enabled from public.hm_reminder_subscriptions where activity_hash=repeat('e',64)) then raise exception 'Optout failed';end if;
q:=public.hm_reactivation_dashboard(actor,0);if q->'items' is null then raise exception 'Missing dashboard';end if;
update public.hm_sender_evidence set confirmed_at=now()-interval '49 hours',expires_at=now()-interval '1 hour' where code=v->>'code';if (public.hm_read_sender_evidence(actor,'community',v->>'code','')->>'available')::boolean then raise exception 'Expired evidence exposed';end if;
if has_function_privilege('anon','public.hm_list_sender_evidence(uuid,text,integer)','execute') or has_table_privilege('authenticated','public.hm_sender_evidence','select') then raise exception 'Private grants exposed';end if;
insert into public.hm_sponsors(code,tracking_hash,company_name,category,contact_name,email,phone,logo_url,destination_url,price_cents,review,payment,cnpj,legal_name) values('HC-SP-TESTCLOSURE',repeat('d',64),'Teste transacional','Outros','Responsável','test@example.invalid','5511999999999','https://example.invalid/logo.png','https://example.invalid',2990,'pending','pending','11222333000181','Teste transacional') returning id into sid;
update public.hm_sponsors set review='approved' where id=sid;if (select starts_at is not null from public.hm_sponsors where id=sid) then raise exception 'Unpaid sponsor started';end if;
update public.hm_sponsors set payment='confirmed' where id=sid;if not (select starts_at=now() and expires_at=now()+interval '7 days' from public.hm_sponsors where id=sid) then raise exception 'Sponsor activation failed';end if;
end $$;
select 'PASS: snapshot, 48h clock, privacy, consent, claim deduplication, return reset, optout, sponsor approval/payment activation' as result;
rollback;
