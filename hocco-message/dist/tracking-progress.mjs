import {esc} from './config.mjs';
// Providers may append checkout metadata after the hash. Only remove a query
// suffix after a complete private token; never accept a partial secret.
export function normalizeTrackingHash(hash,saved=[]){
 const value=String(hash||'').replace(/^#/,'');
 const match=value.match(/^(comunidade-pagamento|acompanhar|pagamento|pedido)\/([A-Z0-9-]+)(?:\/(.*))?$/);
 if(!match)return hash;
 const [,route,code,raw='']=match;
 const clean=raw.match(/^([a-f0-9]{64})(?:[?&].*)?$/)?.[1];
 const key=clean||(!raw||/^[?&]/.test(raw)?saved.find(item=>item.code===code&&/^[a-f0-9]{64}$/.test(item.trackingToken||''))?.trackingToken:null);
 return key?'#'+route+'/'+code+'/'+key:hash;
}
export function communityProgress(post,now=Date.now()){
 const removed=!!post.content_removed_at,expired=!!post.published_at&&Number.isFinite(Date.parse(post.expires_at))&&Date.parse(post.expires_at)<=now;
 const blocked=removed||post.review==='rejected'||post.payment==='refunded'||post.payment_hold||post.hidden_at;
 const paid=post.payment==='confirmed';
 const published=!!post.published_at&&paid&&post.review==='approved'&&!blocked;
 const live=post.destination==='live',read=live&&post.live_status==='read',pendingLive=live&&paid&&post.review==='approved'&&!read&&!blocked;
 return {terminal:!!blocked||read||(!live&&(published||expired)),steps:[
  {label:'Solicitação recebida',done:true},
  {label:'Pagamento confirmado',done:paid},
  {label:post.review==='pending'?'Em análise':'Mensagem aprovada',done:post.review==='approved'},
  {label:live?'Na fila da LIVE':'Publicado na Comunidade',done:published&&(!live||['queued','read'].includes(post.live_status))},
 ...(live?[{label:'Leitura registrada na LIVE',done:read&&!blocked}]:[])
 ],notice:removed?'O conteúdo foi excluído. O registro financeiro foi preservado.':post.payment_hold?'Pagamento em revisão.':post.review==='rejected'?'Mensagem recusada. Consulte o motivo e a devolução abaixo.':post.payment==='refunded'?'Devolução registrada.':post.hidden_at?'Mensagem retirada da exibição.':pendingLive?'Sua mensagem está na fila da LIVE. Aguardando o registro da leitura.':read?'Leitura registrada na LIVE.':expired?'O período de exibição terminou.':published?'Publicação confirmada.':paid?'Aguardando a próxima atualização da solicitação.':'Aguardando confirmação do pagamento pelo Mercado Pago.'};
}
export function progressMarkup(post){const progress=communityProgress(post);return `<section class="tracking-progress" aria-labelledby="tracking-progress-title"><h2 id="tracking-progress-title">Acompanhe sua solicitação</h2><ol>${progress.steps.map((step,i)=>`<li class="${step.done?'is-complete':'is-pending'}"><span aria-hidden="true">${step.done?'✓':i+1}</span><div><strong>${esc(step.label)}</strong><small>${step.done?'Concluído':'Aguardando'}</small></div></li>`).join('')}</ol><p role="status">${esc(progress.notice)}</p>${!progress.terminal?'<small>Atualização automática a cada 3 segundos.</small>':''}</section>`}
