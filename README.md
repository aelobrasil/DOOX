# DOOX / HOCCO — Site Final PWA

## Identidade
- Aba do navegador/site: **Doox**
- App instalado: **HOCCO**
- Ícone/favicons: **D.** com ponto laranja

## PWA
O projeto contém:
- `manifest.webmanifest`
- `sw.js`
- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`

O Service Worker registra e armazena o app shell e os assets locais. Em produção, a Vercel fornece HTTPS, necessário para o funcionamento normal do Service Worker e instalação.

O botão **Instalar HOCCO** aparece quando o navegador oferece o fluxo de instalação. Em navegadores que não oferecem `beforeinstallprompt`, o usuário deve usar a opção de instalação do próprio navegador.

## Fluxo comercial
Escolher → Simular → Revisar → aceitar Termos/Regras → Finalizar → WhatsApp.

A pré-solicitação é local (`localStorage`) e não é banco de dados.

## WhatsApp
+55 14 98115-0675.

## Deploy
Abra a pasta no VS Code e publique na Vercel. O site é estático; Node.js/Vercel CLI é apenas para o processo de deploy.


## V12 — regra comercial definitiva
- Sponsor Overlay e Overlay + Áudio calculam o preço automaticamente a partir da faixa/momento selecionado.
- O campo de faixa/preço é apenas informativo e não pode ser selecionado independentemente do momento.
- Empresa Patrocinadora do Episódio: exatamente 10 vagas por episódio; o formulário limita a quantidade a 10.
- Solicitações e mensagem de WhatsApp usam a mesma regra momento → faixa → preço.


V15: corrige atualização do Service Worker (cache versionado/network-first para index) e adiciona fallback de redirecionamento ao WhatsApp em navegadores móveis. Apps Script V5 normaliza Overlay + Áudio.

## V16 — integração robusta
Esta versão envia a solicitação para `/api/request` no próprio domínio Vercel. A função serverless faz a ponte servidor-a-servidor com o Google Apps Script e devolve JSON ao navegador. Isso elimina o POST `no-cors` opaco do navegador e permite confirmar o registro antes de abrir o WhatsApp.
