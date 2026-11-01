-- Rollback-only assertions; never operate on a real customer's purchase.
begin;
do $$begin
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hocco_rpc_internal' and p.prosecdef)<>45 then raise exception 'Missing legacy implementations';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('authenticated',p.oid,'execute')) then raise exception 'Privileged public API exposed';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hocco_rpc_internal' and has_function_privilege('anon',p.oid,'execute')) then raise exception 'Anonymous private implementation access';end if;
end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$begin
 begin
  perform public.admin_set_comercial_config(null,null,null);
  raise exception 'Unauthenticated admin operation accepted';
 exception when others then
  if sqlerrm<>'not_authorized' then raise;end if;
 end;
 if public.minhas_divulgacoes()<>'[]'::jsonb then raise exception 'Unexpected private records';end if;
end;$$;
reset role;
create function public.hm_hardening_privilege_probe() returns integer language sql as 'select 1';
do $$begin
 if has_function_privilege('anon','public.hm_hardening_privilege_probe()','execute') or has_function_privilege('authenticated','public.hm_hardening_privilege_probe()','execute') then raise exception 'New functions exposed by default';end if;
end;$$;
rollback;
