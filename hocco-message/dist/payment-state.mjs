// Presentation only: payment and delivery facts must come from the server.
export function paymentState(order, kind = 'community', now = Date.now()) {
  if (order.payment === 'refunded') return {state:'refunded',title:'Pagamento devolvido',detail:'A devolução foi registrada. O prazo de crédito depende do meio de pagamento.'};
  if (order.payment !== 'confirmed') return {state:'pending',title:'Aguardando confirmação do pagamento',detail:'Se você já pagou, não pague novamente. Este pedido será atualizado após a confirmação.'};
  if (order.review === 'rejected') return {state:'rejected',title:'Pagamento confirmado · solicitação recusada',detail:'Acompanhe a devolução por este pedido.'};
  if (order.review !== 'approved') return {state:'review',title:'Pagamento confirmado',detail:kind==='sponsor'?'Sua empresa está em análise pela HOCCO.':'Sua mensagem está em análise. A publicação ainda não foi liberada.'};
  if (order.hidden_at || order.archived_at) return {state:'hidden',title:'Conteúdo indisponível',detail:'Consulte o acompanhamento para verificar a situação do seu pedido.'};
  if (kind === 'live') {
    if (order.live_status === 'read') return {state:'read',title:'Leitura registrada na LIVE',detail:'A equipe registrou a leitura da sua mensagem.'};
    if (order.live_status === 'queued') return {state:'queued',title:'Pagamento confirmado',detail:'Sua mensagem entrou na fila da próxima LIVE.'};
    return {state:'processing',title:'Pagamento confirmado',detail:'Estamos processando a entrada da sua mensagem na fila. Não é necessário pagar novamente.'};
  }
  if (kind === 'video') return order.delivery==='published'
    ? {state:'published',title:'Mensagem veiculada',detail:'A equipe registrou a veiculação no vídeo oficial.'}
    : {state:'queued',title:'Pagamento confirmado',detail:'Sua mensagem entrou na fila de produção da HOCCO.'};
  const start=Date.parse(order.published_at),end=Date.parse(order.expires_at);
  if (Number.isFinite(start) && start<=now && Number.isFinite(end)) {
    if (end<=now) return {state:'expired',title:'Período de exibição encerrado',detail:'O prazo contratado desta publicação terminou.'};
    return {state:'published',title:kind==='sponsor'?'Sua empresa está na HOCCO!':'Sua mensagem está na Comunidade!',detail:'Disponível até '+new Date(end).toLocaleString('pt-BR')+'.'};
  }
  return {state:'processing',title:'Pagamento confirmado',detail:'Publicação em processamento. Não é necessário pagar novamente.'};
}
