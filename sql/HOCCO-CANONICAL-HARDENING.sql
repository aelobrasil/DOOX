-- HOCCO canonical infrastructure hardening, 2026-10-02.
-- Mirrors the verified production state of project vebqvedmhfaebvdantiu.

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

revoke execute on function public.registrar_solicitacao(jsonb) from public, anon, authenticated;
revoke execute on function public.registrar_material(uuid, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.acompanhar_solicitacao(bigint, uuid) from public, anon, authenticated;
grant execute on function public.registrar_solicitacao(jsonb) to service_role;
grant execute on function public.registrar_material(uuid, text, text, text, text, text, bigint) to service_role;
grant execute on function public.acompanhar_solicitacao(bigint, uuid) to service_role;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.hocco_touch_atualizado_em() set search_path = pg_catalog, public;

alter view public.v_catalogo set (security_invoker = true);
alter view public.v_solicitacoes set (security_invoker = true);

create index if not exists programacoes_episodio_idx on public.programacoes (episodio_id);
create index if not exists solicitacoes_faixa_idx on public.solicitacoes (faixa_id);
create index if not exists solicitacoes_modalidade_idx on public.solicitacoes (modalidade_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
 ('hocco-logos','hocco-logos',false,5242880,array['image/png','image/jpeg','image/webp']::text[]),
 ('hocco-audios','hocco-audios',false,15728640,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave']::text[])
on conflict (id) do update set
 name=excluded.name, public=excluded.public, file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;
