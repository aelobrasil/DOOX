-- Separate public profile fields from private member/governance data.
-- Public leaderboard uses only allowlisted columns. Full profile is fetched
-- through an invoker RPC that delegates to a non-exposed private helper.

begin;

drop policy if exists perfil_proprio_leitura on public.impulsionadores_perfis;
drop policy if exists perfil_publico_leitura on public.impulsionadores_perfis;
create policy perfil_publico_leitura
  on public.impulsionadores_perfis
  for select
  to authenticated
  using (
    deleted_at is null
    or private.is_hocco_admin((select auth.uid()))
  );

revoke select on table public.impulsionadores_perfis from authenticated;
grant select (
  user_id, nome_publico, username, avatar_url, xp, nivel, ofensiva_dias
) on table public.impulsionadores_perfis to authenticated;

create or replace view public.impulsionadores_perfil_publico
  with (security_barrier = true, security_invoker = true)
as
select user_id,nome_publico,username,avatar_url,xp,nivel,ofensiva_dias
from public.impulsionadores_perfis;

revoke all privileges on table public.impulsionadores_perfil_publico from anon;
grant select on table public.impulsionadores_perfil_publico to authenticated;

create or replace function private.get_my_impulsionador_profile()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select to_jsonb(p)
  from public.impulsionadores_perfis as p
  where p.user_id = (select auth.uid()) and p.deleted_at is null
  limit 1;
$$;

revoke all privileges on function private.get_my_impulsionador_profile() from public;
revoke all privileges on function private.get_my_impulsionador_profile() from anon;
grant usage on schema private to authenticated;
grant execute on function private.get_my_impulsionador_profile() to authenticated;

create or replace function public.get_my_impulsionador_profile()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select private.get_my_impulsionador_profile();
$$;

revoke all privileges on function public.get_my_impulsionador_profile() from public;
revoke all privileges on function public.get_my_impulsionador_profile() from anon;
grant execute on function public.get_my_impulsionador_profile() to authenticated;

create or replace function public.get_public_impulsionador_profiles(p_limit integer default 8)
returns table (user_id uuid,nome_publico text,avatar_url text,xp integer,nivel integer,ofensiva_dias integer)
language sql stable security invoker
set search_path = ''
as $$
  select v.user_id,v.nome_publico,v.avatar_url,v.xp,v.nivel,v.ofensiva_dias
  from public.impulsionadores_perfil_publico as v
  order by v.xp desc
  limit least(greatest(coalesce(p_limit,8),1),20);
$$;

revoke all privileges on function public.get_public_impulsionador_profiles(integer) from public;
revoke all privileges on function public.get_public_impulsionador_profiles(integer) from anon;
grant execute on function public.get_public_impulsionador_profiles(integer) to authenticated;

comment on policy perfil_publico_leitura on public.impulsionadores_perfis
  is 'Permite leitura de linhas não excluídas; colunas privadas não são concedidas aos clientes.';
comment on function public.get_my_impulsionador_profile()
  is 'Returns the authenticated member own complete profile only.';
comment on function public.get_public_impulsionador_profiles(integer)
  is 'Returns only allowlisted public leaderboard fields.';

commit;
