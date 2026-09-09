# DOOX / HOCCO — Integração Google — V47 Final

## Arquitetura
Site → /api/request → Google Apps Script → Google Sheets → /api/request → Painel privado do cliente.

## Planilha
Spreadsheet ID operacional: `1VWJKfePpzoFpH5h8Iyl58MErLGNjvgGB`

A aba operacional visível é `PAGAMENTO`. A aba `PEDIDO` e as abas técnicas permanecem internas/ocultas.

## Web App
O Apps Script deve ser implantado como Web App com acesso compatível com o uso público do site.

## Ações públicas
- `GET health`
- `GET catalog`
- `GET pedido&token=...`
- `GET contract`
- `POST registerRequest`
- `POST informarPagamento`

## Ações protegidas
- `GET/POST testSpreadsheet`
- `POST confirmarPagamento`
- `POST atualizarStatus`
- `POST publicarObservacao`

As ações administrativas exigem a propriedade de Script `DOOX_OPERATOR_TOKEN`. Configure no editor do Apps Script executando `CONFIGURAR_TOKEN_OPERADOR('SEU_TOKEN_LONGO')` com um token de pelo menos 20 caracteres. Nunca publique esse token no site.

## Pagamento
PIX oficial: chave aleatória configurada no Apps Script.
Beneficiário apresentado ao cliente: Alex Sandro Soares Fernandes.
Instituição financeira: Nu Pagamentos S.A. — Instituição de Pagamento (Nubank).
WhatsApp oficial: +55 (14) 98115-0675.

## Regra operacional
O cliente informa pagamento; isso não confirma pagamento. A confirmação é feita pela operação DOOX, pelo fluxo interno autorizado.
