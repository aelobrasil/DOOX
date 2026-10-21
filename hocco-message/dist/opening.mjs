const screen=document.querySelector('.app-opening');
const mount=document.querySelector('#app,#sponsor-app,#admin-app');
const OPENED_KEY='hocco-message-opened-this-session';
let alreadyOpened=false;
try{alreadyOpened=sessionStorage.getItem(OPENED_KEY)==='1';if(!alreadyOpened)sessionStorage.setItem(OPENED_KEY,'1')}catch{}
if(screen&&alreadyOpened){screen.remove()}
else if(screen&&mount){
 const dismiss=()=>{screen.classList.add('is-ready');if(matchMedia('(prefers-reduced-motion: reduce)').matches)screen.remove();else setTimeout(()=>screen.remove(),780)};
 const ready=()=>{const text=(mount.textContent||'').trim();if(mount.children.length&&!/^(Preparando|Consultando|Carregando)/i.test(text)){observer.disconnect();clearTimeout(fallback);dismiss()}};
 const observer=new MutationObserver(ready);
 observer.observe(mount,{childList:true,subtree:true,characterData:true});
 const fallback=setTimeout(()=>{observer.disconnect();dismiss()},8000);
 ready();
}
