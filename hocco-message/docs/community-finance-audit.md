# Correções preparadas: Comunidade, acessos e resumo financeiro

Estado: alterações locais, sem deploy e sem alterações no banco de produção.

## Comunidade

O tema de streaming definia cada cartão com 100% da largura do painel. A rolagem era criada apenas com mais de três mensagens e interrompida sempre que qualquer elemento da seção mantivesse foco, incluindo curtidas acionadas com mouse. A atualização periódica recriava o intervalo.

A versão preparada usa uma faixa inteira, cinco cartões em telas largas, três intermediárias e dois no celular, preservando a leitura. Não fabrica ou duplica comentários para preencher espaços. O intervalo depende de overflow real; se todos os comentários couberem, ficam visíveis juntos. Com overflow, avança e volta ao início. Pausa ao ler com cursor, interação de toque, foco de teclado e movimento reduzido. Curtida com mouse não pausa para sempre. Inclui avançar, voltar e pausar.

Uma atualização igual do feed preserva a rolagem. Falhas transitórias não substituem imediatamente comentários válidos, mas cartões com prazo vencido são retirados. Solicitações simultâneas do mesmo feed são evitadas.

## Contagem de acessos

O evento site_view registra carregamentos de páginas, não pessoas únicas. O relatório diário refere-se ao dia report_date, fechado às 23h59 de Brasília. Diferenças entre dias não são evidência de tráfego irregular.

A versão preparada explicita data, período e definição. A Visão geral apresenta os dois últimos relatórios encerrados separadamente. Não altera a coleta, não acrescenta rastreamento individual e não reescreve os relatórios existentes.

## Pagamentos

A Visão geral anterior mostrava curadoria e pagamentos pendentes, sem recebimentos verificados; seu carregamento era manual. Publicações aprovadas já não aparecem em curadoria. O contador pendente também incluía registros recusados/ocultos.

A preparação acrescenta ao admin.dashboard as últimas 200 transações verificadas já existentes em hm_payments e os dois últimos relatórios. O painel calcula quantidade e valor de pagamentos com provider_status=approved, deduplica o identificador do provedor, não soma confirmações manuais antigas e apresenta histórico indisponível se o backend não enviar os dados. Não é um total financeiro vitalício. Reembolsos/contestações saem da soma de aprovados. Solicitações recusadas, ocultas ou arquivadas saem da contagem pendente.

A Visão geral consulta novamente a cada vinte segundos quando visível e ao receber foco. Não interrompe formulários de outras áreas. Uma resposta atrasada não substitui a área selecionada; uma falha de atualização mantém os dados anteriores com aviso.

## Validação e publicação futura

234 testes locais passaram, incluindo geometria de rolagem, retorno ao início, interação/foco, manutenção do intervalo, contagens financeiras, controle de acesso e atualização atrasada. Consultas somente leitura compararam confirmações recentes do ledger com os pedidos e publicações correspondentes. Não foram criadas cobranças, confirmados pagamentos pelo cliente, emitidos reembolsos, apagados dados ou alterados secrets.

Antes de publicar: conferir visualmente a faixa com dados fictícios, inclusive cinco ou mais mensagens e larguras móveis; rever o branch e a Edge Function atuais para preservar alterações externas. Publicar primeiro a Edge Function atualizada, mantendo verify_jwt=false existente, e depois o frontend testado. Não é necessária migração de banco. Nenhum desses deploys foi executado nesta preparação.
