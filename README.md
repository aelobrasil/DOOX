# DOOX / HOCCO — Blueprint Master 2026 — Vercel (versão definitiva)

Pacote estático preparado para Vercel + VS Code. A interface pública segue o Blueprint Master 2026; o site chama apenas `/api/doox`, e o proxy server-side conversa com o Web App do Apps Script.

## Estrutura
- `index.html` — interface pública, simulação, participação, acompanhamento e rodapé legal.
- `assets/hocco-simulacao-modelo.mp4` — vídeo-modelo usado na simulação, 10 s.
- `assets/overlay-audio-notificacao.mp3` — som de notificação de Overlay + Áudio.
- `api/doox.js` — proxy Vercel → Apps Script.
- `vercel.json` — cache + fallback das rotas públicas.
- `.env.example` — variável obrigatória.
- `manifest.webmanifest` + `sw.js` — PWA.
- `integracao/` — cópia de referência do Apps Script operacional.

## Integração
Planilha oficial: `1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB`
Projeto Apps Script informado: `1nmvXANhTKZ8boFo4fbaA_DDmMWFDlWKq56CrnEMvwagb92Nq34KPTUU4`

A URL do editor do Apps Script não deve ser usada pelo navegador. Publique o Apps Script como Web App e informe no Vercel a URL `/exec` na variável `APPS_SCRIPT_WEBAPP_URL`.

## Deploy no VS Code
1. Abra a pasta no VS Code.
2. `vercel login`
3. `vercel`
4. Cadastre `APPS_SCRIPT_WEBAPP_URL` no Project Settings → Environment Variables.
5. `vercel --prod`

## Importante
O site não possui campos de upload. A simulação usa um monograma automático para representar a marca; quando a arte final da identidade visual for necessária, ela é tratada posteriormente pelos canais oficiais da DOOX.

O site não acessa a planilha diretamente. Preços, capacidade, status, pagamento e criação do pedido são tratados pelo backend do Apps Script.


## Correção V60 — tratamento de erro no finalizar

A interface não usa mais `alert([object Object])`. Respostas de erro vindas do proxy/Apps Script são normalizadas para texto legível, exibidas dentro da própria página e o botão é liberado para nova tentativa.


## V68 — Termo empresarial
- Cadastro de empresas exige leitura até o final e aceite do Termo de Ciência, Segurança e Autorização para Participação Empresarial na HOCCO.
- Pessoa física não vê nem precisa aceitar esse termo.
- O aceite do termo empresarial é gravado no PEDIDO com versão, data/hora do servidor e identificação da assinatura da produção HOCCO.
- Assinatura eletrônica declarada no instrumento: Alex Hocc de D' Mello — Produtor & Showrunner do Reality Biográfico HOCCO.
