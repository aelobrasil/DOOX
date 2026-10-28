export function nextCommunityScroll(positions,left,max,direction=1){if(max<=1)return 0;if(direction>0){if(left>=max-2)return 0;return Math.min(positions.find(p=>p>left+2)??max,max)}if(left<=2)return max;return Math.max(0,[...positions].reverse().find(p=>p<left-2)??0)}
export function mountCommunityCarousel(track,root=track.parentElement){
 let timer=null,hovered=false,touching=false,paused=false,disposed=false;const cleanups=[];
 const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const max=()=>Math.max(0,track.scrollWidth-track.clientWidth);
 const listen=(el,event,fn)=>{el?.addEventListener?.(event,fn);cleanups.push(()=>el?.removeEventListener?.(event,fn))};
 const move=(direction=1)=>{if(disposed||max()<=1)return;const left=track.scrollLeft,origin=track.getBoundingClientRect().left,positions=[...track.querySelectorAll('.community-card')].map(c=>c.getBoundingClientRect().left-origin+left);track.scrollTo({left:nextCommunityScroll(positions,left,max(),direction),behavior:reduced()?'instant':'smooth'})};
 const stop=()=>{clearInterval(timer);timer=null};
 const refresh=()=>{if(disposed)return;const button=root?.querySelector?.('[data-community-motion]');if(button){button.textContent=paused?'Retomar rolagem':'Pausar rolagem';button.setAttribute('aria-pressed',String(paused))}if(paused||reduced()||max()<=1){stop();return}if(timer!==null)return;timer=setInterval(()=>{if(document.hidden||hovered||touching)return;const focus=document.activeElement;if(focus?.closest?.('.community-track')&&focus.matches?.(':focus-visible'))return;move(1)},7000)};
 listen(track,'pointerenter',e=>{if(e.pointerType!=='touch')hovered=true});listen(track,'pointerleave',()=>{hovered=false});listen(track,'pointerdown',()=>{touching=true});listen(globalThis.window,'pointerup',()=>{touching=false});listen(globalThis.window,'pointercancel',()=>{touching=false});
 listen(root?.querySelector?.('[data-community-previous]'),'click',()=>move(-1));listen(root?.querySelector?.('[data-community-next]'),'click',()=>move(1));listen(root?.querySelector?.('[data-community-motion]'),'click',()=>{paused=!paused;refresh()});listen(globalThis.window,'resize',refresh);
 const resize=globalThis.ResizeObserver?new ResizeObserver(refresh):null;resize?.observe(track);refresh();
 return{refresh,move,dispose(){disposed=true;stop();resize?.disconnect();cleanups.forEach(fn=>fn())}};
}
