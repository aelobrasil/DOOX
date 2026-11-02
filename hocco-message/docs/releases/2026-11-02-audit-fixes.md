# Auditoria dos fluxos e retenção

Corrigido o segundo temporizador de 30 segundos do patrocínio que reconstruía o checkout e apagava o QR exibido. A consulta de três segundos mantém a tela enquanto os fatos não mudarem. Respostas de consultas anteriores deixam de substituir rotas novas, inclusive no acompanhamento de vídeos. Consultas em andamento não se sobrepõem. O acompanhamento da LIVE continua até o registro da leitura, mesmo após o período de exibição na Comunidade.

Pix do patrocínio preserva corpo e prazo estáveis ao repetir a mesma chave de idempotência; QR vence junto da reserva de 48 horas. Após vencer, o botão de copiar é desabilitado e a tela pede atualização. Sem criar cobranças reais na auditoria.

Status de publicações vencidas informa encerramento. Revisão financeira e recusa têm prioridade sobre expiração. Retorno de pagamento tolera parâmetros contendo URLs, preservando validação de segredo completo e consulta autorizada no servidor.

Retenção: o conteúdo, identidade pública, aceite e reações da Comunidade são removidos após 24 horas da publicação e após encerrada a exibição contratada. LIVE mantém a mensagem até a leitura e por 24 horas após seu registro. Devoluções concluídas têm retenção de conteúdo por 24 horas após a atualização. Não se remove conteúdo com revisão financeira, alerta no ledger, reconciliação pendente, LIVE não lida ou devolução pendente.

Permanece apenas o registro necessário à conferência financeira e ao acompanhamento privado: código, hash privado, valor, estado do pagamento e datas. O Controle exclui mensagens encerradas sem eliminar esses registros financeiros. As mensagens já removidas não aparecem na fila operacional nem podem ser republicadas. Limpeza automática a cada cinco minutos, em lotes de até 1000. Pedidos sem pagamento seguem com expiração de 20 minutos.

Validação: 292 testes automatizados; smoke SQL transacional com rollback confirma exclusão de conteúdo, preservação financeira, idempotência e proteção de LIVE/devolução/revisão. Prévia em produção: seis mensagens antigas elegíveis e dois casos financeiros preservados. A regra foi inicialmente instalada com agendamento pausado e ativada após publicação das telas compatíveis.

Advisors: nenhum novo alerta; um WARN de proteção contra senhas vazadas depende do plano do Supabase. Tabelas de acesso exclusivo do servidor continuam sem políticas públicas por projeto.

Execução em produção: conteúdo de seis mensagens antigas removido; seis registros financeiros mínimos preservados. Rotina de cinco minutos ativa. Novas mensagens e pendências permanecem na operação.
