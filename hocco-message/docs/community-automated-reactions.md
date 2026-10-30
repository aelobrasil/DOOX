# Reações automáticas da Comunidade

A apresentação pública soma uma reação inicial da HOCCO, uma projeção automática
por mensagem e as curtidas reais retornadas pela API. O valor exibido tem teto de
890, incluindo a reação inicial e os votos reais. O componente automático não
representa pessoas, visitas nem alcance medido.

## Comportamento

- A reação inicial aparece quando a mensagem aprovada e paga está publicada.
- Cada ID tem uma meta, velocidade e cadência determinísticas. A mesma mensagem,
  no mesmo instante, tem a mesma projeção em qualquer navegador.
- Aproximadamente 55% das metas ficam abaixo de 50; apenas 1% ficam entre 700 e
  890. Algumas mensagens expiram antes de alcançar a própria meta.
- A progressão usa `published_at` e `expires_at`, sem reiniciar ao abrir a página,
  recarregar ou limpar o armazenamento do navegador.
- A tela atualiza a cada dez segundos enquanto está visível, sem fazer chamadas
  adicionais ao banco. A projeção congela na expiração.
- O feed e o acompanhamento privado utilizam a mesma função de contagem.

## Dados e manutenção

O módulo `dist/community-reactions.mjs` calcula somente a apresentação. Ele não
grava eventos de voto, não modifica `likes_count` e não participa dos relatórios
administrativos. As curtidas reais mantêm a API `community.like`, identificação
opaca por navegador, resposta autoritativa e reversão de falhas.

Não interpretar a projeção automática como audiência ou engajamento humano em
relatórios, contratos ou apresentações comerciais.

As mudanças de código devem passar por `npm test`, incluindo a distribuição das
metas, monotonicidade, limite, expiração e limpeza dos temporizadores.
