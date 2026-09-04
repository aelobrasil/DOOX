# DOOX / HOCCO — V22 • Operação profissional

## Fonte de verdade
O formulário público deste site é a única entrada de dados comerciais.
O navegador envia somente: nome/empresa, WhatsApp, e-mail, tipo, modalidade, momento, quantidade, perfil/site, observação e aceite.

## Integração
`/api/request.js` filtra novamente o payload antes de encaminhar ao Google Apps Script.
`/api/receipt.js` entrega o PDF do comprovante através de um token privado, sem tornar a pasta do Drive pública.

## Backend
Use o arquivo `DOOX-APPS-SCRIPT-V9-PRODUCAO-MENSAL.gs` fornecido separadamente. O Apps Script mantém apenas 7 abas operacionais:
- PAINEL
- PEDIDOS
- CLIENTES
- FINANCEIRO
- PRODUÇÃO
- EPISÓDIOS
- COMPROVANTES

Os dados antigos não permanecem misturados ao novo ciclo: no fechamento, o backend arquiva o ciclo em um arquivo separado no Drive e zera somente o banco operacional ativo.

## Início do ciclo
No Apps Script, use o menu `DOOX • HOCCO` → `Preparar novo ciclo (backup + zerar + reconstruir)` para a limpeza inicial.

## Fechamento mensal
No fim do mês: `DOOX • HOCCO` → `Fechar mês atual e arquivar`.
Se o fechamento manual não for executado, o primeiro pedido do mês seguinte detecta a mudança de ciclo e faz o rollover automaticamente.

## Comprovante
Após uma solicitação registrada, o site mostra o botão `ABRIR COMPROVANTE DA SOLICITAÇÃO`. O PDF é criado no Drive pelo Apps Script. O acesso do site é feito por token; o arquivo não é compartilhado publicamente.

## WhatsApp
A abertura do WhatsApp deixou de ser automática. Depois do registro, o usuário escolhe entre abrir o comprovante e continuar no WhatsApp.
