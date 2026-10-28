const KEY='hocco-carousel-rating-shown-v1';
export function mountCarouselAdvisory(root){
 const hero=root.querySelector('.cinema-hero'),notice=root.querySelector('.cinema-rating-advisory');
 if(!hero||!notice)return()=>{};
 let shown=false;try{shown=sessionStorage.getItem(KEY)==='1';if(!shown)sessionStorage.setItem(KEY,'1')}catch{}
 if(shown)return()=>{};
 let disposed=false,finishTimer;
 notice.hidden=false;hero.classList.add('is-rating-advisory');
 const timer=setTimeout(()=>{if(disposed)return;notice.classList.add('is-dismissing');finishTimer=setTimeout(()=>{if(disposed)return;notice.hidden=true;hero.classList.remove('is-rating-advisory')},320)},3000);
 return()=>{disposed=true;clearTimeout(timer);clearTimeout(finishTimer);notice.hidden=true;hero.classList.remove('is-rating-advisory')};
}
