# DOOX V2 — novo núcleo operacional

Esta versão substitui a dependência do schema legado `doox_core` por um núcleo versionado `doox_v2`, dentro do mesmo projeto Supabase.

## O que muda

- Site público: `/api/doox-v2`
- Materiais: `/api/materials-v2`
- Administração: `/api/doox-v2-admin`
- Login administrativo: `/api/doox-v2-login`
- Painel privado: `/doox-access-fRiqxdGcydxi5UvdiW89JcVt`
- Banco: schema `doox_v2`
- Storage: bucket privado `doox-v2-arquivos`

O schema e o Core antigos não são apagados por esta instalação. A migração é reversível enquanto o V2 estiver em validação.

## Ordem de implantação

1. No Supabase SQL Editor, execute `sql/DOOX-V2-001-BASE.sql` inteiro.
2. Execute `sql/DOOX-V2-002-TESTE.sql` e confirme que retorna um `codigo_doox` como `DOOX-26-000001` e um `pedido_id` UUID.
3. No Vercel, mantenha/configure:
   - `DOOX_DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DOOX_TRACKING_SECRET`
   - `DOOX_ADMIN_SECRET` e/ou `DOOX_ADMIN_PASSWORD_HASH`
   - `DOOX_PUBLIC_BASE_URL`
4. Publique este pacote.
5. Teste primeiro `/api/doox-v2?action=health`.
6. Faça um pedido real de teste no site.
7. Abra o painel privado e confira se o mesmo Código DOOX aparece em Pedidos.

## Regra de corte

Não remova o legado antes de um pedido V2 completar este caminho:

`SITE → doox_v2.criar_pedido → Código DOOX → materiais → DOOX Core V2 → alteração de status → acompanhamento público`.

Depois desse teste, o legado pode ser arquivado em uma etapa separada.
