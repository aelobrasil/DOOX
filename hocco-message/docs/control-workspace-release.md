# Controle HOCCO — reorganização da operação

O controle agora inicia na Visão geral, com navegação lateral e menu móvel. Os indicadores derivam dos registros carregados por admin.dashboard; quando uma modalidade alcança o limite de 500 linhas, a tela informa que se trata de uma consulta limitada. Não representa faturamento completo nem monitoramento contínuo de disponibilidade.

## Funcionalidades conectadas

- Mensagens de vídeo, curadoria, fila de edição, veiculações e lixeira existentes.
- Comunidade e LIVE, revisão, ocultação, restauração e leitura existentes.
- Patrocinadores, materiais, preços, aprovação/recusa e arquivamento existentes.
- Página dedicada para definir episódio, usando a gravação autenticada existente.
- Preços, disponibilidade, comunicado oficial e duração em Controle geral.
- Financeiro, expansão por cidades, recuperação financeira e programação/laboratório.
- Acesso da equipe mostra a sessão atual. Criação de contas/permissões permanece no Supabase.

## Correções

- Patrocínio ativo exige confirmação de pagamento, aprovação, início, prazo vigente e ausência de bloqueio/arquivo.
- Comunidade visível também exige ausência de ocultação e publicação efetiva.
- Curadoria da Visão geral conta solicitações pagas; pedidos não pagos aparecem na contagem própria.
- Respostas atrasadas do financeiro e da programação não substituem outra tela já selecionada.
- Erros de formulários destacados da tela não provocam escrita em elementos ausentes.
- Falha transitória na atualização oferece nova tentativa.
- Revisados contrastes, cores herdadas, campos, materiais de empresas e espaçamento móvel.

## Verificação

211 testes locais passaram. Incluem métricas, isolamento entre pagamento/revisão/publicação, navegação por todas as seções, logout e resposta assíncrona atrasada. Navegador: 11 destinos do menu, atalho para empresa, formulário de episódio e formulário de preços em dados fictícios. Conferência visual desktop e iframe de 390 px, incluindo abrir/fechar menu e ir a Episódios.

Arquivos de prévia usam API fictícia e são removidos da árvore de produção. Não foram usados logins reais, nem executados reembolso, compra, alteração de preço ou curadoria em dados reais. Não houve mudança de backend, credenciais ou permissões.

Não acrescenta edição do carrossel pelo controle, nova identidade do cliente entre aparelhos, administração de ofensivas centralizada ou novos poderes de equipe. Essas funcionalidades não são apresentadas como prontas na interface.
