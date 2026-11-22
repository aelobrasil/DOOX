-- Harden Hocco Impulsionadores profile access.
-- Users may read their own complete profile, while public leaderboards use
-- a deliberately limited view. Client updates are restricted to editable fields.
begin;
revoke all privileges on table public.impulsionadores_perfis from anon;
revoke all privileges on table public.impulsionadores_perfis from authenticated;
grant select on table public.impulsionadores_perfis to authenticated;
grant insert (user_id, nome_publico, username, bio, avatar_url)
  on table public.impulsionadores_perfis to authenticated;
grant update (nome_publico, username, bio, avatar_url, updated_at)
  on table public.impulsionadores_perfis to authenticated;
drop policy if exists perfil_publico_leitura on public.impulsionadores_perfis;
drop policy if exists perfil_proprio_leitura on public.impulsionadores_perfis;
create policy perfil_proprio_leitura on public.impulsionadores_perfis
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_hocco_admin((select auth.uid())));
create or replace view public.impulsionadores_perfil_publico
  with (security_barrier = true, security_invoker = false)
as select user_id,nome_publico,username,avatar_url,xp,nivel,ofensiva_dias
   from public.impulsionadores_perfis where deleted_at is null;
revoke all privileges on table public.impulsionadores_perfil_publico from anon;
grant select on table public.impulsionadores_perfil_publico to authenticated;
comment on policy perfil_proprio_leitura on public.impulsionadores_perfis
  is 'Membros autenticados leem somente o próprio perfil; administradores autorizados podem ler todos.';
comment on view public.impulsionadores_perfil_publico
  is 'Lista pública limitada a identificador e campos de exibição/progressão não sensíveis.';
commit;
