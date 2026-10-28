const NS='http://www.w3.org/2000/svg';
const selectors='.btn,.cinema-primary,.cinema-secondary,.cinema-bottom-actions a,.home-view-all,.cinema-section-heading>a,.cinema-sponsor-card span,.cinema-search-results a,.cinema-watch-copy>a,.cinema-editorial>a,.profile-info-link,.profile-send-button';
export function enhanceNavigation(root=document){
 root.querySelectorAll(selectors).forEach(el=>{
  if(el.dataset.navigationEnhanced&&el.querySelector('.navigation-icon'))return;
  if(el.closest('[data-no-navigation-icon]'))return;
  const nodes=[...el.childNodes].filter(n=>n.nodeType===3),arrow=nodes.find(n=>/[←→↗‹›]/.test(n.textContent))||[...el.children].find(n=>n.tagName==='SPAN'&&/^[\s←→↗‹›]+$/.test(n.textContent));
  if(!arrow)return;
  const backward=/^[\s]*[←‹]/.test(arrow.textContent),external=/↗/.test(arrow.textContent);
  for(const n of nodes)n.textContent=n.textContent.replace(/[←→↗‹›]/g,'').trim();
  // Existing decorative arrow spans are also replaced, without touching labels or click handlers.
  el.querySelectorAll('span[aria-hidden="true"]').forEach(s=>{if(/^[\s←→↗‹›]+$/.test(s.textContent))s.remove()});
  const wrap=document.createElement('span');wrap.className='navigation-icon';wrap.setAttribute('aria-hidden','true');
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');
  const path=document.createElementNS(NS,'path');path.setAttribute('d',external?'M7 17 17 7M7 7h10v10':backward?'M19 12H5m6-6-6 6 6 6':'M5 12h14m-6-6 6 6-6 6');svg.append(path);wrap.append(svg);
  if(backward)el.prepend(wrap);else el.append(wrap);
  el.dataset.navigationEnhanced='true';el.classList.add('navigation-action');
 });
}
if(typeof document!=='undefined'){
 let queued=false;
 const refresh=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhanceNavigation()})};
 enhanceNavigation();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
}
