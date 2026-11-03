# Operação após esta publicação

## Controle

- **Remetentes · 48h**: pedidos de vídeo, Comunidade e LIVE aprovados e pagos, com nome completo informado, telefone informado, IP observado, mensagem, modalidade, valor e vencimento. A consulta gera auditoria automaticamente; não exige justificativa digitada. Busca por nome/código e páginas de 50 registros.
- A janela começa na primeira confirmação do pagamento. Novas confirmações do mesmo pedido não prorrogam o prazo. O conteúdo privado preserva a mensagem original durante a janela, mesmo que a publicação pública seja removida antes. Sem pagamento, a janela privada continua sendo 48h da criação; o comentário não pago continua expirando em 20 minutos.
- Pedidos antigos sem dados coletados não terão nome completo, telefone ou IP reconstruídos. Informações declaradas e IP não comprovam identidade. Não há envio automático a autoridades.
- **Reativação**: elegíveis, enviados hoje (Brasília), retornos, conversões, pausas e falhas; lista paginada e atualização manual. As métricas de retorno e conversão usam 30 dias. Retorno significa abertura deste navegador após uma notificação; conversão significa pagamento posterior ao retorno em até sete dias, não causalidade comprovada.

## WhatsApp: condição externa para liberar os envios

O motor está instalado no cron horário existente. **Não envia enquanto os modelos e as credenciais não estiverem configurados.** O Controle mostra esse estado. Não é necessário manter o Work aberto.

No Supabase → Edge Functions → Secrets, manter as credenciais já existentes e cadastrar os nomes exatos dos modelos **já aprovados na Meta**, sem compartilhar tokens no frontend:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION` (versão suportada pela conta, formato `vNN.N`)
- `WHATSAPP_REMINDER_TEMPLATE_LANGUAGE` (`pt_BR`, se esse for o idioma aprovado)
- `WHATSAPP_REACTIVATION_TEMPLATE_1`
- `WHATSAPP_REACTIVATION_TEMPLATE_2`
- `WHATSAPP_REACTIVATION_TEMPLATE_3`
- `WHATSAPP_REACTIVATION_TEMPLATE_PARTICIPANT`
- `WHATSAPP_REACTIVATION_TEMPLATE_ABANDONED`

Cada modelo recebe dois parâmetros de corpo, nesta ordem: nome de exibição e URL pública do app. Sugestões de texto estão em `supabase/functions/hocco-message/reactivation.mjs`. Os modelos de reativação são comunicações de marketing; precisam da categoria e autorização correspondentes no provedor. Custos do WhatsApp seguem a conta contratada, sem novo plano de infraestrutura criado nesta revisão.

A autorização é opcional no formulário de envio e só aparece quando o canal estiver pronto. O telefone de segurança, sozinho, **não** inscreve ninguém. Visitantes sem contato autorizado não recebem WhatsApp. A identificação de retorno depende do navegador/link privado; não promete rastrear a mesma pessoa em todos os aparelhos.

Após 48h de ausência: primeira tentativa, personalizada para participação paga ou envio abandonado; depois mais duas tentativas espaçadas em 48h; depois intervalo de 14 dias. A rotina é horária, então pode haver até aproximadamente uma hora de diferença. Atrasos não geram vários envios acumulados. Retornar reinicia a contagem de ausência, sem enviar no mesmo dia. Três falhas consecutivas pausam os envios. Desativação no perfil impede novos disparos. Eventos e contatos inativos são eliminados após 90 dias. Esses registros de comunicação autorizada são separados do cofre de segurança de 48h.

Envios abandonados cujo prazo de pagamento expirou exigem **novo envio**; a comunicação não promete recuperar um comentário já eliminado.

## Empresas

Novos pedidos seguem: cadastro completo e revisão → solicitação → análise da equipe → pagamento após aprovação → publicação por sete dias. Dados e imagens são enviados antes da análise. O Controle permite aprovar ou recusar sem pagamento. Pedidos já pagos continuam analisáveis; devoluções reais continuam verificadas no Mercado Pago.

Há uma modalidade atual de patrocínio de sete dias, com quantidade de uma participação por solicitação. Não foram criados planos ou quantidades que o servidor não suporta. O preço continua sendo o definido no Controle. O prazo existente de pagamento do patrocinador continua sendo 48h após a solicitação; a equipe deve analisar dentro desse período. A disponibilidade por cidade continua sendo verificada no banco.

## Verificação

A suíte automatizada inclui bloqueio de checkout antes da aprovação, atividade por segredo privado, cancelamento antes do disparo, falta de configuração, escape de dados e encerramento das consultas ao sair da tela. Testes transacionais no banco são revertidos e não criam pedidos reais nem pagamentos no provedor.
