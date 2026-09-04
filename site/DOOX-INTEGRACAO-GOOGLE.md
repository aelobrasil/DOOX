# DOOX / HOCCO — integração oficial

Fonte de verdade do formulário público: `index.html`.

Proxy Vercel de solicitação: `/api/request.js`.
Proxy Vercel de comprovante: `/api/receipt.js`.
Backend oficial: Apps Script publicado como Web App.

O navegador envia apenas os campos públicos do formulário. Código DOOX, ID Cliente, data/hora, status, faixa/preço calculados, controle mensal e arquivos são criados pelo backend.

O site nunca envia episódio. O episódio é definido pela produção.

O comprovante é criado pelo Apps Script e entregue ao cliente pelo endpoint `/api/receipt?token=...`, sem tornar a pasta do Drive pública.
