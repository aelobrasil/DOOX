const screen=document.querySelector('.rating-opening');
const OPENED_KEY='hocco-message-rating-opened-v1';
let alreadyOpened=false;
try{alreadyOpened=sessionStorage.getItem(OPENED_KEY)==='1';if(screen&&!alreadyOpened)sessionStorage.setItem(OPENED_KEY,'1')}catch{}
if(screen&&alreadyOpened)screen.remove();
else if(screen){
 let finished=false;const timers=[];
 const later=(fn,ms)=>{const id=setTimeout(fn,ms);timers.push(id);return id};
 const finish=()=>{if(finished)return;finished=true;timers.forEach(clearTimeout);screen.classList.add('is-ready');setTimeout(()=>screen.remove(),480)};
 screen.querySelector('.rating-opening-skip')?.addEventListener('click',finish,{once:true});
 later(()=>screen.classList.add('is-text-fading'),2500);
 later(()=>{
  if(finished)return;
  const mark=screen.querySelector('.rating-opening-mark'),target=document.querySelector('.cinema-age-rating');
  if(mark&&target&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const a=mark.getBoundingClientRect(),b=target.getBoundingClientRect();
   if(b.width>0&&b.top>=0&&b.bottom<=window.innerHeight&&b.left>=0&&b.right<=window.innerWidth){
    mark.style.setProperty('--rating-x',`${b.left+b.width/2-a.left-a.width/2}px`);
    mark.style.setProperty('--rating-y',`${b.top+b.height/2-a.top-a.height/2}px`);
    mark.style.setProperty('--rating-scale',String(b.width/a.width));
    screen.classList.add('is-transferring');later(finish,700);return;
   }
  }
  finish();
 },3000);
}
