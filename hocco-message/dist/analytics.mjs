import {api} from './config.mjs';

const allowed=new Set(['participation_open','compose_video','compose_community','compose_live','checkout_open','checkout_error','channel_open','order_lookup']);
let lastEvent='',lastAt=0;

export function track(event){
  if(!allowed.has(event))return;
  const now=Date.now();
  if(event===lastEvent&&now-lastAt<1500)return;
  lastEvent=event;lastAt=now;
  Promise.resolve().then(()=>api('analytics.event',{event})).catch(()=>{});
}
