const POSTER='/assets/cinema/resgatar-poster-oficial-v2.webp';
export function mountOfficialPoster(root,{onOpen=()=>{},onClose=()=>{}}={}){
 const trigger=root.querySelector('[data-official-poster]');if(!trigger)return()=>{};
 let dialog=null,disposed=false;
 const dismiss=()=>dialog?.close();
 const open=event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(disposed||dialog?.open)return;
  dialog=document.createElement('dialog');dialog.className='official-poster-dialog';dialog.setAttribute('aria-labelledby','official-poster-title');
  dialog.innerHTML=`<div class="official-poster-heading"><div><span>HOCCO · PARTE 1</span><h2 id="official-poster-title">RESGATAR — Pôster oficial</h2></div><button class="official-poster-close" type="button" autofocus aria-label="Fechar pôster oficial">✕ <span>Fechar</span></button></div><div class="official-poster-viewport"><img class="official-poster-image" src="${POSTER}" width="1024" height="1536" alt="Pôster oficial de HOCCO, RESGATAR, Parte 1. Uma borboleta sem cor emerge da água, com uma asa danificada. Dentro das asas há desenhos de foguetes, lançamento, show, pirâmides invertidas, pessoas cochichando, projetos de escola e palco, e um balanço com uma pequena borboleta no pátio escolar. Um pequeno REC vermelho aparece abaixo do título."><p class="official-poster-error" role="status" hidden>Não foi possível carregar o pôster. Feche e tente novamente.</p></div><div class="official-poster-footer"><button class="official-poster-full" type="button" aria-pressed="false">Ver em tela cheia</button></div>`;
  const current=dialog,expand=current.querySelector('.official-poster-full'),viewport=current.querySelector('.official-poster-viewport');
  current.querySelector('.official-poster-close').addEventListener('click',dismiss);
  expand.addEventListener('click',()=>{const expanded=current.classList.toggle('is-expanded');expand.setAttribute('aria-pressed',String(expanded));expand.textContent=expanded?'Voltar ao enquadramento':'Ver em tela cheia';viewport.scrollTop=0});
  current.querySelector('img').addEventListener('error',()=>{current.querySelector('.official-poster-error').hidden=false});
  current.addEventListener('click',e=>{if(e.target===current)dismiss()});
  current.addEventListener('close',()=>{document.body.classList.remove('official-poster-open');current.remove();if(dialog===current)dialog=null;if(!disposed){trigger.focus({preventScroll:true});onClose()}},{once:true});
  document.body.append(current);document.body.classList.add('official-poster-open');current.showModal();onOpen();
 };
 trigger.addEventListener('click',open);
 return()=>{disposed=true;trigger.removeEventListener('click',open);if(dialog){dialog.close();dialog.remove();dialog=null;document.body.classList.remove('official-poster-open')}};
}
