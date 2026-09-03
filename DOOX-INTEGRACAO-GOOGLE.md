# DOOX / HOCCO — Integração com Google Sheets

## O que foi integrado no V13
O site envia a solicitação para o endpoint do Google Apps Script antes de abrir o WhatsApp.

Fluxo:
SITE → Google Apps Script → Google Sheets
SITE → WhatsApp DOOX

O WhatsApp continua sendo apenas o canal de atendimento.

## URL configurada no site
A URL `/exec` informada na configuração do projeto foi incorporada ao `index.html`.

## Como concluir a ativação
1. Abra a planilha Google que será usada como painel.
2. Vá em **Extensões → Apps Script**.
3. Apague o conteúdo do `Code.gs` e cole o conteúdo de `DOOX-APPS-SCRIPT-Code.gs`.
4. Salve.
5. Faça **Implantar → Nova implantação → Aplicativo da Web**.
6. Execute como **Eu** e permita acesso a **Qualquer pessoa**.
7. Use a URL `/exec` dessa implantação no site. Se o Google gerar uma nova URL, substitua a URL no `index.html`.

## Validação do servidor
O Apps Script recalcula os preços pelo momento/faixa recebido, valida modalidade, e-mail, telefone brasileiro e aceites. O valor vindo do navegador não é tratado como autoridade.

Patrocinadora do Episódio: limite de 10 por episódio.

## Observação operacional
O site usa `fetch` com `no-cors` para fazer o POST a partir da página estática. Isso significa que o navegador não consegue ler a resposta JSON do Apps Script, mas consegue realizar o envio. O site abre o WhatsApp em paralelo e mantém o fluxo comercial.
