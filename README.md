# DOOX / HOCCO — V31 DEFINITIVO

Pacote operacional definitivo para o site HOCCO + Google Apps Script.

## Arquitetura da planilha

Abas visíveis: PEDIDO e PAGAMENTO.

A aba CLIENTE foi removida da operação. Os dados do solicitante pertencem ao próprio PEDIDO.

Abas técnicas ficam ocultas: _EPISÓDIOS, _VEICULAÇÕES, _LOG e _CLIENTE_LEGADO quando houver.

## Controle de status

O status é alterado diretamente na própria célula por lista suspensa. Não há botões/checkboxes fixos no final das linhas.

Fluxo: SOLICITADO → EM ANÁLISE → AGUARDANDO PAGAMENTO → PAGAMENTO RECEBIDO → MATERIAL PENDENTE → MATERIAL RECEBIDO → EM PRODUÇÃO → PROGRAMADO → PUBLICADO → FINALIZADO.

Exceções: REJEITADO, CANCELADO, ARQUIVADO.

## Implantação

1. Abra o Apps Script vinculado/associado à planilha operacional.
2. Substitua o código pelo arquivo DOOX-APPS-SCRIPT-Code.gs.
3. Salve.
4. Execute setupMVP() uma vez e autorize as permissões solicitadas.
5. Não execute resetarEstruturaAntiga() durante o teste normal.
6. Faça um pedido de teste pelo site e valide o fluxo completo.
