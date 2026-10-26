# HOCCO — identidade cinematográfica — 26/10/2026

Referência aprovada: preto/laranja, degradês, balanço com borboleta, carrossel, trilha e chamada “Você chegou no meio da história.”

## Mudanças
- Entrada com fundo horizontal gerado para o projeto, cinco imagens, setas, miniaturas, controles de teclado/toque, pausa do carrossel e respeito a movimento reduzido.
- Trilha completa fornecida pelo responsável, otimizada em MP3 96kbps. Sem autoplay audível: requer botão explícito. Loop contínuo sem reiniciar nas transições; pausa ao ocultar a página ou navegar; controle de volume. Não entra no cache de instalação.
- Sinopse, Episódios e Projetos com conteúdo editorial real/previsto, sem episódios, durações ou datas fictícias. Botões para os canais oficiais @hoccpov.
- Comunidade, curtidas, LIVE programada, fila, ofertas locais e perfil continuam usando as APIs reais. Nenhuma participação, curtida ou empresa de demonstração foi adicionada ao banco.
- Header, busca de áreas, navegação móvel, perfil, cadastro de empresas, checkout e acompanhamento com visual preto/laranja, preservando endpoints e regras existentes.
- Avatar do cabeçalho usa o mesmo perfil local e atualiza ao salvar escolhas. Nenhuma nova conta/sincronização foi inventada.
- Favicon, ícone PWA, tema e cache atualizados. Área administrativa mantém sua operação e proteção; não houve alteração de banco, preços, secrets ou provedor de pagamentos nesta entrega.

## Validação
113 testes Node passaram, incluindo execução dos controles: sem autoplay, manutenção da posição do áudio entre slides, pausa por visibilidade e descarte de timers/listeners ao sair. Smoke test visual de desktop antes da promoção. CSS responsivo e navegação móvel implementados; a sessão de navegador não disponibilizou emulação móvel para conferência visual. Não houve compra real de validação.

## Limites
O design adapta a referência ao conteúdo disponível e às dimensões reais das telas; não publica empresas, números de curtidas ou episódios fictícios presentes na imagem de referência. Progresso de reprodução, favoritos e catálogo dinâmico de episódios dependem de implementação futura. As pendências operacionais anteriores, incluindo a verificação real do checkout externo, não são resolvidas por uma troca visual.
