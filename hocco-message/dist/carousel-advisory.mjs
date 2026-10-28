const KEY='hocco-carousel-rating-shown-v1';
export function mountCarouselAdvisory(root){
 const hero=root.querySelector('.cinema-hero'),notice=root.querySelector('.cinema-rating-advisory'),badge=root.querySelector('.cinema-age-rating');
 if(!hero||!notice)return()=>{};
 let shown=false;try{shown=sessionStorage.getItem(KEY)==='1';if(!shown)sessionStorage.setItem(KEY,'1')}catch{}
 let disposed=false,initial=!shown,hovered=false,focused=false,pinned=false,finishTimer,initialTimer;
 const listeners=[];
 const listen=(el,type,fn)=>{el?.addEventListener?.(type,fn);listeners.push(()=>el?.removeEventListener?.(type,fn))};
 const render=()=>{
  if(disposed)return;clearTimeout(finishTimer);const visible=initial||hovered||focused||pinned;badge?.setAttribute?.('aria-expanded',String(visible));
  if(visible){notice.hidden=false;notice.classList.remove('is-dismissing');hero.classList.add('is-rating-advisory')}
  else if(!notice.hidden){notice.classList.add('is-dismissing');finishTimer=setTimeout(()=>{if(disposed)return;notice.hidden=true;hero.classList.remove('is-rating-advisory')},320)}
 };
 const dismiss=()=>{initial=false;hovered=false;focused=false;pinned=false;clearTimeout(initialTimer);render()};
 listen(badge,'pointerenter',e=>{if(e.pointerType==='touch')return;hovered=true;render()});
 listen(badge,'pointerleave',()=>{hovered=false;render()});
 listen(badge,'focus',()=>{focused=Boolean(badge.matches?.(':focus-visible'));render()});
 listen(badge,'blur',()=>{focused=false;render()});
 listen(badge,'click',e=>{initial=false;clearTimeout(initialTimer);if(e.detail>0)focused=false;pinned=!pinned;render()});
 listen(badge,'keydown',e=>{if(e.key==='Escape')dismiss()});
 listen(globalThis.document,'pointerdown',e=>{if(!pinned)return;if(badge?.contains?.(e.target)||notice.contains?.(e.target))return;dismiss()});
 render();if(initial)initialTimer=setTimeout(()=>{initial=false;render()},3000);
 return()=>{disposed=true;clearTimeout(initialTimer);clearTimeout(finishTimer);listeners.forEach(fn=>fn());notice.hidden=true;hero.classList.remove('is-rating-advisory');badge?.setAttribute?.('aria-expanded','false')};
}
