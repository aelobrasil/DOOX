# Auditoria de pagamentos fictícios — 27/10/2026

## Resultado

- 165 testes Node passaram: 113 anteriores e 52 novos cenários em `tests/payment-audit.test.mjs`.
- 23 verificações PostgreSQL passaram em tabelas temporárias no projeto sandbox. A transação terminou com ROLLBACK.
- Os seis arquivos da Edge Function `hocco-message` v69 recuperados do Supabase eram idênticos aos arquivos locais testados.
- A rotina financeira usada no teste PostgreSQL foi copiada por leitura da definição em produção. Somente as referências `public.` foram substituídas por `pg_temp.`. Não foi alterada a rotina em produção.

## Cobertura

Handler real com dependências injetadas e sem rede externa: aprovação, reembolso, contestação, mediação, pendência, recusa, cancelamento, processamento, assinatura falsa, valor divergente, moeda divergente, recebedor divergente, ambiente divergente, pedido inexistente, indisponibilidade do provedor e falha de gravação. Cobertura dos tipos `community`, `order` e `sponsor`.

Motor separado do laboratório e apresentação: Comunidade 4h, LIVE 24h e fila, vídeo aguardando veiculação, patrocinador aguardando curadoria, aprovação posterior iniciando sete dias, leitura de LIVE e devolução. Estes testes do motor do laboratório não substituem as regras do banco nem validam o Mercado Pago.

PostgreSQL: confirmação e duração, duplicata de notificação sem nova auditoria ou ampliação de prazo, segunda transação sinalizada, retenção por disputa, evento antigo ignorado, devolução e prevenção de republicação, LIVE na fila, vídeo sem veiculação automática, preservação da prova de vídeo já entregue após reembolso, empresa paga ainda em curadoria, conteúdo oculto ou recusado sem publicação, valor incorreto, reutilização de transação e bloqueio de publicação sem pagamento.

As tabelas temporárias contêm apenas os campos necessários e uma restrição sintética de publicação. Não reproduzem todos os índices, triggers, permissões ou concorrência da produção. Não foi executado teste de carga ou de duas sessões concorrentes.

## Inspeção de produção somente por leitura

- Zero registros na consulta de mensagens com datas de publicação sem pagamento confirmado e aprovação.
- Zero registros na consulta de patrocínios com período ativo, não arquivados, sem pagamento confirmado e aprovação.
- Zero registros na consulta de vídeos marcados como publicados com pagamento diferente de confirmado.
- `hm_apply_verified_payment`, `hm_community_admin_action`, `hm_community_payment_claim` e `hm_confirm_community_payment`: EXECUTE negado a `anon` e `authenticated`, permitido a `service_role`.

Essas contagens são uma fotografia dos registros existentes e não comprovam que todas as condições futuras sejam impossíveis.

## Limitação concreta

O sandbox persistente não contém `public.hm_payments` nem `public.hm_apply_verified_payment` da versão atual. Portanto, não houve compra ponta a ponta no checkout de testes do Mercado Pago, webhook externo real ou teste visual simultâneo com cliente e controle autenticado.

Para a próxima etapa: alinhar a estrutura do ambiente isolado e disponibilizar nele a função atual com credenciais e webhook exclusivamente de teste. Depois executar checkout de comprador fictício, notificação externa e acompanhamento nas duas interfaces. Não reutilizar ou alterar credenciais de produção para isso.

Nenhum segredo foi lido ou alterado; nenhuma compra, devolução real, publicação pública ou mudança de preço foi efetuada. Não houve deploy. A execução SQL usou somente tabelas temporárias no sandbox; produção foi consultada por leitura.

## Reprodução

`npm test` na raiz do app executa a suíte Node. O roteiro SQL em `tests/payment-database-audit.sql` requer inserir no marcador uma cópia revisada da rotina financeira atual com referências `pg_temp.` e terminador de comando antes do bloco de testes. Executar exclusivamente no sandbox em uma transação única e manter o ROLLBACK final.
