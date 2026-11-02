export function isParticipationRoute(hash){return /^(enviar|pagamento|comunidade-pagamento|acompanhar)(?:\/|$)/.test(String(hash||'').replace(/^#/,''))}
export function flowProgress(step=1){return '<ol class="participation-progress" data-flow-progress aria-label="Etapas da participação">'+['Sua mensagem','Pagamento','Acompanhar'].map((label,i)=>'<li class="'+(i+1<=step?'is-active':'')+'" '+(i+1===step?'aria-current="step"':'')+'><span>'+(i+1)+'</span><strong>'+label+'</strong></li>').join('')+'</ol>'}
export function setParticipationTheme(active){
 document.body.classList.toggle('participation-flow',active);
 const header=document.querySelector('body>header');
 if(header&&!header.querySelector('.participation-back')){const back=document.createElement('a');back.className='participation-back';back.href='/#inicio';back.textContent='← Voltar para HOCCO';header.prepend(back)}
}
export function decorateParticipation(root,stepOverride){
 if(!document.body.classList.contains('participation-flow')||!root||root.querySelector('[data-flow-progress]'))return;
 const step=stepOverride??(location.hash.startsWith('#acompanhar')?3:/^#(?:pagamento|comunidade-pagamento)/.test(location.hash)?(root.querySelector('.payment-card')?2:3):1);
 root.insertAdjacentHTML('afterbegin',flowProgress(step));
 const simulation=root.querySelector('.simulation-area');
 if(simulation&&!simulation.closest('details')){const details=document.createElement('details');details.className='participation-preview';const summary=document.createElement('summary');summary.textContent='Ver prévia da mensagem no vídeo';simulation.before(details);details.append(summary,simulation);const video=simulation.querySelector('video');if(video){video.autoplay=false;video.pause();details.addEventListener('toggle',()=>{if(details.open)video.play().catch(()=>{});else video.pause()})}}
}
