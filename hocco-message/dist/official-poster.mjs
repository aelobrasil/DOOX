const POSTER='/assets/cinema/resgatar-poster-oficial-v1.webp';
export function mountOfficialPoster(root,{onOpen=()=>{},onClose=()=>{}}={}){
 const trigger=root.querySelector('[data-official-poster]');if(!trigger)return()=>{};
 let dialog=null,disposed=false;
 const dismiss=()=>dialog?.close();
 const open=event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();if(disposed||dialog?.open)return;
  dialog=document.createElement('dialog');dialog.className='official-poster-dialog';dialog.setAttribute('aria-labelledby','official-poster-title');
  dialog.innerHTML=`<div class="official-poster-heading"><div><span>HOCCO · PARTE 1</span><h2 id="official-poster-title">RESGATAR — Pôster oficial</h2></div><button class="official-poster-close" type="button" autofocus aria-label="Fechar pôster oficial">✕</button></div><img class="official-poster-image" src="${POSTER}" width="1024" height="1536" alt="Pôster oficial de HOCCO, RESGATAR, Parte 1. Uma borboleta sem cor emerge da água, com uma asa danificada e lembranças dentro das asas: desenhos de foguetes, show, pirâmides invertidas, pessoas cochichando, grito, lágrima e balanço. Um pequeno REC vermelho aparece abaixo do título."><p class="official-poster-error" role="status" hidden>Não foi possível carregar o pôster. Tente abrir a imagem abaixo.</p><a class="official-poster-full" href="${POSTER}" target="_blank" rel="noopener noreferrer">Abrir imagem em tamanho completo ↗</a>`;
  const current=dialog;
  current.querySelector('button').addEventListener('click',dismiss);
  current.querySelector('img').addEventListener('error',()=>{current.querySelector('.official-poster-error').hidden=false});
  current.addEventListener('click',e=>{if(e.target===current)dismiss()});
  current.addEventListener('close',()=>{document.body.classList.remove('official-poster-open');current.remove();if(dialog===current)dialog=null;if(!disposed){trigger.focus({preventScroll:true});onClose() }},{once:true});
  document.body.append(current);document.body.classList.add('official-poster-open');current.showModal();onOpen();
 };
 trigger.addEventListener('click',open);
 return()=>{disposed=true;trigger.removeEventListener('click',open);if(dialog){dialog.close();dialog.remove();dialog=null;document.body.classList.remove('official-poster-open')}};
}
