# Reação da HOCCO e curtidas reais

O contador soma uma reação oficial inicial da HOCCO e as curtidas reais da API.
A marca é identificada ao lado do contador. Não há metas por mensagem, crescimento
calculado pelo tempo, sorteio de números nem teto artificial de 890.

- A reação inicial aparece quando a mensagem está publicada.
- Sem novos votos, o número permanece igual, mesmo após horas ou recarregamentos.
- A atualização do feed e do acompanhamento de curtidas ocorre a cada 30 segundos
  enquanto o app está visível. Não há animação no contador.
- O coração da marca tem uma animação breve na montagem, respeitando a preferência
  de redução de movimento do dispositivo.
- Os avisos de novas curtidas usam somente aumentos reais da API em mensagens do
  próprio cliente, identificadas pelo histórico local. A primeira consulta cria
  uma referência sem anunciar votos antigos como novos.
- Os avisos aparecem dentro do app aberto. Não foram adicionadas notificações
  push, mensagens externas nem promessas de aviso com o navegador fechado.
- O acompanhamento de vídeo avisa quando o servidor informa a transição para
  publicado e oferece o botão existente para assistir à mensagem no YouTube.

A alteração anterior era exclusivamente de apresentação e não gravou curtidas
fictícias no banco. Os votos reais e os relatórios permanecem íntegros. O feed,
a API de votos e o acompanhamento continuam usando os controles existentes.

Validação: `npm test` cobre contagem constante sem votos, voto/desvoto,
reconciliação de falhas, notificações, expiração e limpeza dos temporizadores.
