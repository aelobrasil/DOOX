# Limpeza administrativa e participação

A limpeza não é executada na publicação. Exige sessão da equipe, prévia e confirmação, sem motivo digitado.

Botões em Visão geral, Mensagens, Comunidade/LIVE, Empresas, Lixeira e Controle administrativo. Laboratório já possui limpeza dos próprios cenários isolados. Configurações, membros administrativos, preços e financeiro não são apagados pelo botão.

Exclusão definitiva é conservadora: pedidos/empresas devem estar arquivados, sem pagamento confirmado/devolvido, sem contestação/alegação de pagamento, sem transação no ledger e sem trabalho de recuperação financeira. Comunidade/LIVE nunca publicadas e sem associação financeira podem ser excluídas. Esses bloqueios são reaplicados no banco na execução. Os dois pagamentos reais de R$0,01 informados pelo proprietário como testes permanecem rastreáveis; nenhum cliente foi cobrado nesta atualização.

Os relatórios e eventos de abertura só podem ser limpos após 30 dias. Totais de cidades e registros financeiros permanecem intactos. A prévia mostra quantidades e a confirmação exclui apenas os IDs selecionados na consulta, não registros novos.

Logos/capas removíveis entram em fila transacional. Exclusão física usa API de Storage e caminhos restritos a sponsors/ no bucket da aplicação; arquivos ainda referenciados não são removidos. Falhas ficam pendentes para reprocessamento pelo mesmo diálogo. Não é feita exclusão SQL no schema Storage.

A limpeza libera espaço lógico reutilizável no Postgres, sem promessa de redução imediata do tamanho físico do banco. O Storage só libera o arquivo após remoção pela API.

CTA vermelho de participação mantém o formulário existente, YouTube é ação secundária, sem alterar dados nem preços. Carrossel e indicadores incluem os ajustes descritos em community-finance-audit.md.
