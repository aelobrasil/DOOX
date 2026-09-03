# DOOX HOCCO — Integração Google Sheets

Esta versão já está integrada ao endpoint do Google Apps Script.

Fluxo:

1. O cliente preenche a solicitação.
2. O site envia a solicitação ao Apps Script.
3. O Apps Script registra o pedido na aba `PEDIDOS`.
4. O servidor calcula/prevalece sobre faixa e preço.
5. O site consulta o registro pelo `Client Request ID`.
6. O código DOOX retornado é incluído na mensagem do WhatsApp.
7. O WhatsApp só é aberto depois da confirmação do registro.

## Antes de publicar

No Google Apps Script, substitua o conteúdo por `DOOX-APPS-SCRIPT-Code.gs`, salve e faça:

Implantar → Gerenciar implantações → Editar → Nova versão → Implantar.

O endpoint configurado no site é:

https://script.google.com/macros/s/AKfycbwsoDs3kQ-2AC4WLW7_yHl-EQ5_BJvWow-3VG-f5eUz0a46kFR98ZCHSz6wcXgWzRWZmQ/exec

Depois teste uma solicitação real de ponta a ponta.
