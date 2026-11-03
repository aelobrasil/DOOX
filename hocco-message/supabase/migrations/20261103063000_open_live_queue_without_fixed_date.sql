begin;
create or replace function public.hm_snapshot_live_program() returns trigger language plpgsql security invoker set search_path='' as $$
declare cfg public.hm_programming; occupied integer;
begin
 if new.destination<>'live' or exists(select 1 from public.hm_community_messages where tracking_hash=new.tracking_hash) then return new; end if;
 select * into cfg from public.hm_programming where id=1 for update;
 if not found or not cfg.live_accepting or (cfg.next_live_at is not null and cfg.next_live_at<=now()) then raise exception 'A fila da próxima LIVE está pausada. Aguarde a reabertura.'; end if;
 select count(*) into occupied from public.hm_community_messages where destination='live' and live_status<>'read' and content_removed_at is null and review<>'rejected' and payment<>'refunded' and hidden_at is null and (payment='confirmed' or (payment='pending' and created_at>now()-interval '20 minutes'));
 if occupied>=cfg.live_capacity then raise exception 'A fila desta LIVE está completa. Aguarde a próxima programação.'; end if;
 new.live_scheduled_at:=cfg.next_live_at; new.live_title:=cfg.next_live_title;
 return new;
end $$;
create or replace function public.hm_update_programming(p_actor uuid,p_payload jsonb) returns public.hm_programming language plpgsql security invoker set search_path='' as $$
declare old public.hm_programming; saved public.hm_programming;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
 select * into old from public.hm_programming where id=1 for update;
 update public.hm_programming set topic=p_payload->>'topic',next_live_title=p_payload->>'liveTitle',next_live_at=nullif(p_payload->>'liveAt','')::timestamptz,live_capacity=(p_payload->>'capacity')::integer,live_accepting=(p_payload->>'accepting')::boolean,updated_at=now() where id=1 returning * into saved;
 if saved.live_accepting and ((saved.next_live_at is not null and saved.next_live_at<=now()) or char_length(saved.next_live_title)<2) then raise exception 'Defina um título e, se informar uma data, escolha um horário futuro.'; end if;
 insert into public.hm_audit(actor_id,action,detail) values(p_actor,'programming_update',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(saved)));
 return saved;
end $$;
revoke all on function public.hm_snapshot_live_program() from public,anon,authenticated;
revoke all on function public.hm_update_programming(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.hm_update_programming(uuid,jsonb) to service_role;
-- Reopen the existing queue without inventing a broadcast date or changing prices.
insert into public.hm_audit(action,detail) select 'live_queue_reopened',jsonb_build_object('before',to_jsonb(p),'reason','Fila da próxima LIVE aberta sem data definida, por solicitação do responsável') from public.hm_programming p where id=1;
update public.hm_programming set next_live_at=null,live_accepting=true,updated_at=now() where id=1;
commit;
