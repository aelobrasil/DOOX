# Expiração de comentários e correções de confiabilidade

## Regra de pagamento

Mensagens para vídeo, Comunidade e LIVE expiram 20 minutos após a criação sem
pagamento confirmado. Não se aplica ao cadastro de patrocinadores. O servidor
bloqueia o pagamento ao vencer o prazo; o checkout emitido também recebe validade.
A limpeza executa a cada minuto e remove o comentário, dados de publicação e
auditoria associada de pedidos pendentes elegíveis, liberando suas vagas.

Registros pagos, reembolsados, publicados, com pagamento identificado ou em
revisão financeira são preservados. A limpeza usa bloqueio de linha e ignora
registros em transação para não disputar com a confirmação de pagamento.

A tabela privada `hm_expired_purchases` preserva somente modalidade, código,
UUID original, hash do link privado, preço e datas. Não contém mensagem, nome,
perfil, avatar nem imagens. Permite reconhecer pagamentos atrasados e marcá-los
no financeiro para conferência. Não recria a publicação nem executa reembolso
sem a operação autorizada da equipe.

## Correções

- Pedidos arquivados, ocultos ou com prazo de publicação vencido não abrem checkout.
- Votos reais são aceitos em publicações de Comunidade e LIVE ativas; mensagens
  ocultas ou com retenção financeira não aceitam votos.
- Reenvios de vídeo, Comunidade e patrocínio mantêm o identificador após falhas
  de rede ou recarga da aba, sem armazenar conteúdo adicional no identificador.
- Requisições têm tempo limite para não deixar o botão preso indefinidamente.
- Eventos da prévia de tela cheia são removidos ao sair ou reconstruir a tela.
- O controle trata erro de logo por evento externo, compatível com a CSP.
- O suporte não navega também a aba original ao abrir o WhatsApp.
- Pagamentos de comentários removidos aparecem como atenção no financeiro.
- Os termos v12 e as telas informam a janela de 20 minutos antes do pagamento.

## Publicação e verificação

Aplicar a estrutura e funções primeiro, publicar a Edge Function e o cliente,
então ativar a migração de cron e executar a limpeza inicial. As migrações são
separadas para preservar a identificação financeira durante a troca de versões.

`npm test` verifica servidor e cliente. `tests/purchase-expiry-smoke.sql` exercita
as funções reais do Postgres com rollback, incluindo exclusão, preservação dos
pagos, pagamento atrasado, evento fora de ordem, idempotência e votos da LIVE.

A abertura de cidades e a programação de LIVE são configurações comerciais que
dependem da equipe. Esta correção não inventa datas, não abre cidades nem altera
pagamentos existentes para simular devoluções.
