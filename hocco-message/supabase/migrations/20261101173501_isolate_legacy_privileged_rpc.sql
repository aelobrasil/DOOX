-- Keep legacy API contracts while isolating privileged execution from exposed schemas.
-- Original OIDs and bodies are retained so database dependencies remain intact.
create schema if not exists hocco_rpc_internal authorization postgres;
revoke all on schema hocco_rpc_internal from public, anon, authenticated;
grant usage on schema hocco_rpc_internal to authenticated;
alter default privileges for role postgres in schema hocco_rpc_internal revoke execute on functions from public, anon, authenticated;

do $hardening$
declare f record; call_args text; volatility text; parallelism text; strictness text; affected integer:=0;
begin
 for f in
  select p.oid,p.proname,p.pronargs,p.provolatile,p.proparallel,p.proisstrict,
   pg_get_function_arguments(p.oid) as args,
   pg_get_function_identity_arguments(p.oid) as identity_args,
   pg_get_function_result(p.oid) as result,
   obj_description(p.oid,'pg_proc') as description
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.proname in (
  'admin_company_saved_counts',
  'admin_confirmar_pagamento_patrocinio',
  'admin_credit_message_set_status',
  'admin_data_health',
  'admin_engine_summary',
  'admin_run_data_lifecycle',
  'admin_set_comercial_config',
  'admin_set_content_status',
  'admin_set_patrocinio',
  'admin_solicitar_alteracao_oferta',
  'atualizar_oferta_solicitacao',
  'atualizar_oferta_solicitacao_v2',
  'atualizar_oferta_solicitacao_v3',
  'atualizar_presenca_hocco',
  'business_saved_audience',
  'complete_content_video',
  'criar_oferta_solicitacao',
  'criar_oferta_solicitacao_v2',
  'criar_presenca_hocco',
  'hocco_comercial_config_public',
  'hocco_content_feed',
  'hocco_hc_config_public',
  'hocco_ofertas_proximas',
  'hocco_offer_price',
  'hocco_story_feed',
  'informar_pagamento_oferta',
  'informar_pagamento_patrocinio',
  'marcas_comunidade_ativas',
  'marcas_permanentes_ativas',
  'marcas_permanentes_disponibilidade',
  'member_credit_messages',
  'member_notification_feed',
  'member_saved_company_ids',
  'minhas_divulgacoes',
  'oferta_missao_progresso',
  'registrar_oferta_evento',
  'registrar_patrocinio_evento',
  'renovar_patrocinio',
  'republicar_oferta',
  'republicar_oferta_v2',
  'resgatar_experiencia_hc',
  'start_content_video',
  'submit_credit_message',
  'tem_area_divulgacoes',
  'toggle_saved_company')
 loop
  if has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Unexpected anonymous legacy access for %',f.proname;end if;
  if not has_function_privilege('authenticated',f.oid,'EXECUTE') then raise exception 'Unexpected legacy privileges for %',f.proname;end if;
  select coalesce(string_agg('$'||i,',' order by i),'') into call_args from generate_series(1,f.pronargs) as i;
  volatility:=case f.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end;
  parallelism:=case f.proparallel when 's' then 'safe' when 'r' then 'restricted' else 'unsafe' end;
  strictness:=case when f.proisstrict then 'strict' else 'called on null input' end;
  execute format('alter function public.%I(%s) set schema hocco_rpc_internal',f.proname,f.identity_args);
  execute format('revoke all on function hocco_rpc_internal.%I(%s) from public,anon,authenticated',f.proname,f.identity_args);
  execute format('grant execute on function hocco_rpc_internal.%I(%s) to authenticated',f.proname,f.identity_args);
  execute format('create function public.%I(%s) returns %s language sql %s %s parallel %s security invoker set search_path = '''' as %L',
    f.proname,f.args,f.result,volatility,strictness,parallelism,
    format('select * from hocco_rpc_internal.%I(%s)',f.proname,call_args));
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated,service_role',f.proname,f.identity_args);
  execute format('grant execute on function public.%I(%s) to authenticated',f.proname,f.identity_args);
  if f.description is not null then execute format('comment on function public.%I(%s) is %L',f.proname,f.identity_args,f.description);end if;
  affected:=affected+1;
 end loop;
 if affected<>45 then raise exception 'Expected exactly 45 legacy functions, got %',affected;end if;
end;
$hardening$;
notify pgrst,'reload schema';

