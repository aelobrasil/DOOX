begin;
alter table public.hm_admin_record_actions drop constraint hm_admin_record_actions_action_check;
alter table public.hm_admin_record_actions add constraint hm_admin_record_actions_action_check check (action in ('archive_all','restore','delete_sponsor','archive'));
create or replace function public.hm_archive_record(p_actor uuid,p_type text,p_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare previous jsonb;
begin
 if not exists(select 1 from public.hm_team_members where user_id=p_actor and active) then raise exception 'Acesso restrito à equipe.'; end if;
 if length(trim(coalesce(p_reason,''))) not between 2 and 500 then raise exception 'Informe o motivo do arquivamento.'; end if;
 if p_type='sponsor' then
  select to_jsonb(s) into previous from public.hm_sponsors s where id=p_id for update;
 elsif p_type='order' then
  select to_jsonb(o) into previous from public.hm_orders o where id=p_id and is_demo=false for update;
 else raise exception 'Tipo inválido.';
 end if;
 if previous is null then raise exception 'Registro não encontrado.'; end if;
 if previous->>'archived_at' is not null then return jsonb_build_object('ok',true,'alreadyArchived',true); end if;
 if p_type='sponsor' then update public.hm_sponsors set archived_at=now(),updated_at=now() where id=p_id;
 else update public.hm_orders set archived_at=now(),updated_at=now() where id=p_id; end if;
 insert into public.hm_admin_record_actions(actor_id,action,target_type,target_id,detail)
 values(p_actor,'archive',p_type,p_id,jsonb_build_object('reason',trim(p_reason),'code',previous->>'code','payment',previous->>'payment','review',previous->>'review'));
 return jsonb_build_object('ok',true,'type',p_type,'id',p_id);
end;
$$;
revoke all on function public.hm_archive_record(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.hm_archive_record(uuid,text,uuid,text) to service_role;
-- Retired destructive API; retain its signature for older deployments, but never delete.
create or replace function public.hm_delete_sponsor(p_actor uuid,p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'Exclusão definitiva desativada. Envie o registro para a lixeira.';
end;
$$;
revoke all on function public.hm_delete_sponsor(uuid,uuid) from public,anon,authenticated;
commit;
