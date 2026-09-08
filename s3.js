
(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}));
  let deferred=null;
  const btn=document.getElementById('installAppBtn');
  const toast=document.getElementById('installToast');
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(btn)btn.style.display='inline-flex';});
  btn?.addEventListener('click',async()=>{
    if(deferred){deferred.prompt(); try{await deferred.userChoice;}catch(_){} deferred=null; return;}
    if(toast){toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4200);}
  });
})();
