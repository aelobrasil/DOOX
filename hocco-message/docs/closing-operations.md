# Operação após esta publicação

## Controle

- **Remetentes · 48h**: pedidos de vídeo, Comunidade e LIVE aprovados e pagos, com nome completo informado, telefone informado, IP observado, mensagem, modalidade, valor e vencimento. A consulta gera auditoria automaticamente; não exige justificativa digitada. Busca por nome/código e páginas de 50 registros.
- A janela começa na primeira confirmação do pagamento. Novas confirmações do mesmo pedido não prorrogam o prazo. O conteúdo privado preserva a mensagem original durante a janela, mesmo que a publicação pública seja removida antes. Sem pagamento, a janela privada continua sendo 48h da criação; o comentário não pago continua expirando em 20 minutos.
- Pedidos antigos sem dados coletados não terão nome completo, telefone ou IP reconstruídos. Informações declaradas e IP não comprovam identidade. Não há envio automático a autoridades.
- **Reativação**: elegíveis, enviados hoje (Brasília), retornos, conversões, pausas e falhas; lista paginada e atualização manual. As métricas de retorno e conversão usam 30 dias. Retorno significa abertura deste navegador após uma notificação; conversão significa pagamento posterior ao retorno em até sete dias, não causalidade comprovada.

## Dados e limpeza

O Controle tem uma área **Dados e limpeza**, também acessível pelos atalhos da Visão geral. Mostra contagens de vencidos, registros privados ainda protegidos, recibos financeiros preservados, mensagens da LIVE ainda pendentes e pagamentos em atenção. O link de Remetentes mantém a consulta restrita a IP, nome completo e telefone.

**Conferir vencidos** atualiza os números. **Limpar somente vencidos** pede confirmação e revalida os prazos no servidor, sem solicitar justificativa. Não elimina registros privados antes das 48h, recibos financeiros ou conteúdo com entrega/devolução em atenção. A retirada antecipada de uma mensagem pública é feita na área dela e não elimina o cofre privado.

Os prazos existentes foram preservados: comentário não pago em 20 minutos, conteúdo elegível da Comunidade e LIVE concluída após 24h segundo as condições do banco e dados privados por 48h. A LIVE paga ainda na fila permanece protegida. O prazo de 48h começa na primeira confirmação do pagamento; sem pagamento, na criação do pedido.

Relatórios e eventos de abertura de página com mais de 30 dias podem ser limpos automaticamente. Essa opção começa ativada nesta publicação e pode ser alterada nesta tela. A mudança não desliga a expiração obrigatória dos comentários e dados privados. A limpeza central roda a cada hora, além das rotinas existentes de um e cinco minutos. A tela mostra a última execução, a situação das rotinas e os contadores retornados pelo banco.

A ferramenta **Exclusão definitiva por área** continua com prévia e confirmação. Pagamentos e pendências têm proteções no banco. Limpeza de conteúdo e exclusão de registros não significam redução imediata do tamanho físico alocado do banco; o espaço pode ser reutilizado pelo PostgreSQL.

## Retorno pelo próprio app — push

A reativação usa notificações do **HOCCO Reality**, sem WhatsApp e sem o telefone de segurança. O app tem um sino e a opção **Gerenciar notificações do app** no perfil, com histórico e controle de ativação. A permissão do navegador/aparelho é pedida somente após toque em Ativar. Não há convite fictício de uma pessoa nem promessa de evento novo não confirmado.

O serviço reutiliza as chaves VAPID já existentes no servidor. A chave privada permanece no Vault e na execução do servidor. A inscrição fica em tabelas próprias do Message; não mistura assinantes ou campanhas do outro app HOCCO. O cron `hocco-message-push` verifica elegíveis a cada cinco minutos. Não precisa manter o Work ou o app aberto, nem contratar provedor de WhatsApp.

Após 48h sem atividade neste navegador: um aviso; depois mais dois com intervalo de 48h; em seguida, 14 dias. Variação por visitante, participação iniciada e participação paga. Atrasos não geram múltiplos disparos acumulados. Retornar cancela a reserva de envio pendente e reinicia a contagem de ausência. Um aviso já entregue ao serviço push pode chegar depois; não é possível recolhê-lo do sistema operacional. O TTL do envio é de uma hora para limitar avisos atrasados. Três falhas consecutivas pausam a inscrição; resposta 404/410 desativa o endereço inválido.

A pessoa precisa ativar as notificações neste aparelho. No iPhone/iPad, o web app precisa estar na Tela de Início. Bloqueio de notificações, falta de rede, bateria e restrições do sistema podem impedir ou atrasar a exibição. Enviadas no Controle significa **aceitas pelo serviço push**; não leitura confirmada.

O sino mostra até as 50 notificações mais recentes deste aparelho e permite marcar como lida. O clique na notificação externa abre o Reality, sem levar ao WhatsApp. Retorno e conversão são indicadores de atividade deste navegador; não identificação universal da pessoa nem prova de causalidade. Inscrições inativas, histórico e métricas são eliminados após 90 dias conforme a política; os registros são separados dos dados privados de segurança de 48h.

A recorrência de WhatsApp implementada anteriormente foi desativada. Os modelos e segredos `WHATSAPP_REACTIVATION_TEMPLATE_*` não são usados para chamar a pessoa de volta.

## Empresas

Novos pedidos seguem: cadastro completo e revisão → solicitação → análise da equipe → pagamento após aprovação → publicação por sete dias. Dados e imagens são enviados antes da análise. O Controle permite aprovar ou recusar sem pagamento. Pedidos já pagos continuam analisáveis; devoluções reais continuam verificadas no Mercado Pago.

Há uma modalidade atual de patrocínio de sete dias, com quantidade de uma participação por solicitação. Não foram criados planos ou quantidades que o servidor não suporta. O preço continua sendo o definido no Controle. O prazo existente de pagamento do patrocinador continua sendo 48h após a solicitação; a equipe deve analisar dentro desse período. A disponibilidade por cidade continua sendo verificada no banco.

## Verificação

A suíte automatizada inclui bloqueio de checkout antes da aprovação, atividade por segredo privado, cancelamento antes do disparo, falta de configuração, escape de dados e encerramento das consultas ao sair da tela. Testes transacionais no banco são revertidos e não criam pedidos reais nem pagamentos no provedor.
