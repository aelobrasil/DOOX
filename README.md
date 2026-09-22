# DOOX / HOCCO — Blueprint Master 2026

Site público HOCCO preparado para Vercel com DOOX CORE server-side.

## Arquitetura

Site 1 → `/api/doox` → DOOX CORE API → Supabase Postgres (`doox_core`)

O navegador não recebe credenciais do banco. A conexão do servidor usa somente `DOOX_DATABASE_URL` no ambiente da Vercel.

## Variáveis da Vercel

Configure:

- `DOOX_DATABASE_URL`
- `DOOX_TRACKING_SECRET`
- `DOOX_ADMIN_SECRET`
- `DOOX_PUBLIC_BASE_URL`
- `DOOX_TRACKING_TTL_DAYS` (opcional)

## Supabase

O banco precisa conter o schema `doox_core` criado pelo SQL MASTER do DOOX CORE. O código deste site não acessa as tabelas antigas `public.*` nem a antiga integração Apps Script.

Para produção/serverless, use a conexão do **Transaction Pooler** do Supabase para `DOOX_DATABASE_URL`.

## Ações públicas

- `GET /api/doox?action=health`
- `GET /api/doox?action=catalogo`
- `GET|POST /api/doox?action=simular`
- `POST /api/doox?action=registerRequest`
- `GET /api/doox?action=pedido&token=...`
- `POST /api/doox?action=informarPagamento`

## Ações privadas do DOOX CONTROL

Todas usam o header:

`x-doox-admin-secret: <DOOX_ADMIN_SECRET>`

A API já contempla confirmação de pagamento, materiais, aprovação, momento, posições, produção, programação, veiculação, finalização, cancelamento, dashboard, fila, disponibilidade e mapa operacional.

## Segurança

- service/database credentials ficam somente no servidor;
- token de acompanhamento é assinado com HMAC;
- pagamento informado pelo cliente não muda para RECEBIDO automaticamente;
- preço é calculado no banco;
- pedido usa chave de idempotência;
- estado operacional, pagamento, material, produção e veiculação permanecem separados.

A pasta `integracao/` do V68 é mantida apenas como referência histórica. Não é utilizada pela nova rota `/api/doox`.


## V70 — fluxo de materiais
Materiais agora usam upload direto ao Supabase Storage por URL assinada, evitando que arquivos de até 15 MB passem pelo body da função Vercel. Depois do upload, o arquivo é registrado no DOOX CORE.
