begin;
do $$
declare m public.hm_community_messages; result jsonb; test_id uuid:=gen_random_uuid(); key text:=replace(gen_random_uuid()::text,'-','');
begin
 insert into public.hm_community_messages(id,code,tracking_hash,member_name,member_username,avatar_index,message,price_cents,payment,review,published_at,expires_at,duration_hours,created_at,updated_at)
 values(test_id,'HC-CM-'||upper(substr(key,1,12)),key||key,'Teste de retenção','teste_retencao',1,'Mensagem descartável de teste',1,'confirmed','approved',now()-interval '2 days',now()-interval '2 days'+interval '4 hours',4,now()-interval '2 days',now()-interval '2 days') returning * into m;
 if not public.hm_community_content_removable(m,true) then raise exception 'Expired delivered content must be eligible';end if;
 m.destination:='live';m.live_status:='queued';
 if public.hm_community_content_removable(m,true) then raise exception 'Unread LIVE must be protected';end if;
 m.live_status:='read';m.updated_at:=now()-interval '2 days';
 if not public.hm_community_content_removable(m,true) then raise exception 'Old LIVE reading must be eligible';end if;
 m.payment_hold:=true;
 if public.hm_community_content_removable(m,false) then raise exception 'Financial hold must be protected';end if;
 m.payment_hold:=false;m.review:='rejected';
 if public.hm_community_content_removable(m,false) then raise exception 'Pending refund must be protected';end if;
 result:=public.hm_remove_community_content(array[test_id],true,true);
 if (result->>'removed')::int<>1 then raise exception 'Expected one content removal';end if;
 select * into m from public.hm_community_messages where id=test_id;
 if m.content_removed_at is null or m.message<>'Conteúdo excluído' or m.member_username<>'removido' then raise exception 'Content was not removed';end if;
 if m.price_cents<>1 or m.payment<>'confirmed' or m.tracking_hash<>key||key then raise exception 'Financial receipt changed';end if;
 if public.hm_community_content_removable(m,true) then raise exception 'Repeated cleanup must be idempotent';end if;
end $$;
rollback;
