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
