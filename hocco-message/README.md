# Hocco Message

Snapshot dos arquivos públicos da implantação de produção do Hocco Message recuperado em 21/10/2026. O frontend é servido como arquivos estáticos em `dist/`; a integração de dados e pedidos continua no Supabase.

## Vercel

- Diretório do projeto: `hocco-message`
- Saída estática: `dist`
- Node: 24
- `vercel.json` preserva os redirects e cabeçalhos usados pelo app.

Não inclua tokens privados, chaves secretas ou arquivos `.env` neste repositório. Credenciais de pagamento devem ficar como segredos nas Edge Functions do Supabase.

Este snapshot recupera a versão publicada; ainda não é uma integração de pagamento Mercado Pago. As rotas e fluxo de pagamento existentes foram mantidos.
