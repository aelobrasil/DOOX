-- Keep the public profile view invoker-scoped and expose leaderboard data
-- through a narrow, authenticated RPC instead of a SECURITY DEFINER view.

begin;

alter view public.impulsionadores_perfil_publico set (security_invoker = true);

create or replace function public.get_public_impulsionador_profiles(p_limit integer default 8)
returns table (
  user_id uuid,
  nome_publico text,
  avatar_url text,
  xp integer,
  nivel integer,
  ofensiva_dias integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    p.nome_publico,
    p.avatar_url,
    p.xp,
    p.nivel,
    p.ofensiva_dias
  from public.impulsionadores_perfis as p
  where p.deleted_at is null
    and p.governance_status = 'active'
  order by p.xp desc, p.updated_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all privileges on function public.get_public_impulsionador_profiles(integer) from public;
revoke all privileges on function public.get_public_impulsionador_profiles(integer) from anon;
grant execute on function public.get_public_impulsionador_profiles(integer) to authenticated;

comment on function public.get_public_impulsionador_profiles(integer)
  is 'Returns only public leaderboard fields for active, non-deleted members.';

commit;
