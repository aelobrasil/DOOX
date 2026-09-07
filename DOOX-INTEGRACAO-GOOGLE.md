# DOOX / HOCCO — Operação definitiva — V31

## Arquitetura

A planilha operacional tem somente duas abas visíveis:

- `PEDIDO`: registro comercial completo da solicitação e status operacional.
- `PAGAMENTO`: controle financeiro e cópia operacional do status do pedido.

Não existe mais cadastro permanente de `CLIENTE`. Nome, WhatsApp, e-mail, perfil e demais dados do solicitante ficam registrados no próprio pedido. A estrutura técnica (`_EPISÓDIOS`, `_VEICULAÇÕES`, `_LOG`) permanece oculta. Abas antigas de cliente, quando encontradas na migração, são preservadas como `_CLIENTE_LEGADO` e ficam ocultas.

## Controle de status

O operador não usa caixas ou botões fixos. O status fica na própria célula, ao lado do pedido. Ao clicar, o Google Sheets abre a lista de próximas etapas válidas para aquela situação. Após a escolha, o Apps Script valida a transição, atualiza `PEDIDO`, sincroniza `PAGAMENTO`, registra o log e alimenta o painel privado do cliente.

Para recusar uma participação, escreva o motivo em `Observação Cliente` (na aba `PEDIDO`) ou em `Observação` (na aba `PAGAMENTO`) e depois selecione `REJEITADO` pelo status. Sem motivo, a mudança é recusada.

## Fluxo operacional

`SOLICITADO` → `EM ANÁLISE` → `AGUARDANDO PAGAMENTO` → `PAGAMENTO RECEBIDO` → `MATERIAL PENDENTE` → `MATERIAL RECEBIDO` → `EM PRODUÇÃO` → `PROGRAMADO` → `PUBLICADO` → `FINALIZADO`

Também existem `REJEITADO`, `CANCELADO` e `ARQUIVADO` como estados excepcionais.

## Implantação

1. Abra a planilha operacional existente.
2. Abra o projeto do Google Apps Script vinculado ao Web App.
3. Substitua o conteúdo pelo arquivo `DOOX-APPS-SCRIPT-Code.gs`.
4. Salve.
5. Execute `setupMVP()` uma vez e autorize os acessos solicitados.
6. Confirme que ficam visíveis somente `PEDIDO` e `PAGAMENTO`.
7. Faça uma solicitação de teste pelo site.
8. Confirme uma mudança de status diretamente na célula `Status`.
9. Confirme um pagamento pela célula `Status pagamento` ou alterando o status para `PAGAMENTO RECEBIDO` quando permitido.
10. Abra o link privado do pedido e confirme que o status mudou.

## Web App

O site usa o endpoint já configurado em `api/request.js`. Ao publicar nova versão do Apps Script, mantenha a mesma implantação/URL para que o proxy do site continue funcionando.

Após salvar o Apps Script, use `Implantar → Gerenciar implantações → Editar → Nova versão → Implantar` e teste a URL do Web App.

## Fechamento mensal

Use `fecharMesEArquivar()` para arquivar o ciclo e iniciar a operação limpa com novo episódio. O fechamento não utiliza mais a aba `CLIENTE`.
