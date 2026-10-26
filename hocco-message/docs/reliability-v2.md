# HOCCO Message — versão de confiabilidade

Base: 3d8c97a344a0d03d7bc59f43bb549626db33321c.

## Implementado
- Checkout de patrocinadores com importação correta, sem gerador PIX legado; falha de sessionStorage não bloqueia pedido.
- Reset local preserva pedidos e auditoria. Endpoint legado de exclusão recusa a operação.
- Confirmação visual distingue pagamento, curadoria, publicação, expiração, ocultação e revisão financeira.
- Ledger hm_payments com RPC atômico service-only para gravação de pagamento e liberação; idempotência e proteção contra eventos antigos.
- Validação no servidor de assinatura, referência, valor, moeda, recebedor e ambiente.
- Webhooks de reembolso/contestação/mediação; bloqueio de exposição pública quando há revisão financeira.
- Reconciliação ao acompanhar pedido pendente: consulta ao Mercado Pago, limitada a uma por pedido a cada 30 segundos. Não é tarefa agendada independente do cliente.
- Financeiro autenticado no Controle Geral, últimas 200 transações da nova versão; histórico anterior preservado.
- Duração contratada armazenada por mensagem; novas mensagens LIVE publicam por 24 horas e entram na fila; comunidade usa duração configurada no pedido.
- Polling com pausa em tela oculta, rascunho de comunidade na sessão e feedback nas modalidades.
- Cache PWA atualizado e remoção da referência ao ícone inexistente.

## Validação
88 testes Node passaram: estados, execução do checkout com API simulada, reset, validação financeira e execução do handler de webhook.
Teste SQL transacional com rollback passou: nova LIVE 24h, duplicata sem ampliar prazo nem duplicar auditoria, contestação, reembolso e notificação antiga. Nenhum pedido real foi alterado por esse teste.
ACL confirmada: RPC financeiro inacessível para anon/authenticated, disponível para service_role.

## Ainda fora desta entrega
Identidade persistente e recuperação de conta, ofensiva no servidor, Realtime privado, reserva concorrente de patrocínio antes da cobrança, revisão completa de exclusões administrativas, edição de pedidos, moderação contextual por provedor de IA, notificações WhatsApp e reconciliação financeira agendada. Não apresentar esses itens como concluídos.
Não houve compra real de validação. A disponibilidade efetiva de Pix/cartões depende do Mercado Pago e da conta conectada.
