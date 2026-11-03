import test from 'node:test';import assert from 'node:assert/strict';
import {mountCinema,cinemaHomeMarkup,cinemaSlides} from '../dist/cinema.mjs';
class El{
 constructor(){this.listeners=new Map();this.attrs={};this.dataset={};this.classList={toggle(){}};this.value='.3';this.textContent='';}
 addEventListener(k,f){this.listeners.set(k,f)}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k)}setAttribute(k,v){this.attrs[k]=v}querySelector(){return this.label||(this.label=new El())}async fire(k,e={}){return this.listeners.get(k)?.(e)}
}
test('cinema audio needs explicit play, keeps its position across slides and pauses on hide/cleanup',async()=>{
 const saved={Audio:globalThis.Audio,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};let instance;const timers=new Map();let timerId=0;
 globalThis.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.document=Object.assign(new El(),{hidden:false});
 globalThis.Audio=class extends El{constructor(){super();instance=this;this.paused=true;this.currentTime=12;this.playCalls=0}async play(){this.playCalls++;this.paused=false;await this.fire('play')}pause(){this.paused=true;this.fire('pause')}};
 const selectors=new Map();const get=s=>{if(!selectors.has(s))selectors.set(s,new El());return selectors.get(s)};
 const frames=cinemaSlides.map(()=>new El()),slides=cinemaSlides.map((_,i)=>Object.assign(new El(),{dataset:{cinemaSlide:String(i)}}));const root={querySelector:s=>s==='.cinema-rating-advisory'?null:get(s),querySelectorAll:s=>s==='.cinema-frame'?frames:s==='[data-cinema-slide]'?slides:[]};
 try{const dispose=mountCinema(root,{participate(){},reducedMotion:()=>false});assert.equal(instance.playCalls,0);assert.equal(timers.size,1);assert.equal([...timers.values()][0].ms,4000);await get('.cinema-hero').fire('pointerenter',{pointerType:'mouse'});assert.equal(timers.size,1);await get('.cinema-hero').fire('focusin',{target:{closest:selector=>selector.includes('.cinema-participation-cta')}});assert.equal(timers.size,1,'participation CTA focus must not stop slides');await get('.cinema-hero').fire('focusin',{target:{closest:selector=>selector.includes('.cinema-official-poster')}});assert.equal(timers.size,0,'focused official poster may pause slides');await get('.cinema-hero').fire('focusout',{relatedTarget:null});assert.equal(timers.size,1);await get('.cinema-hero').fire('focusin',{target:{closest:selector=>selector.includes('.cinema-sound')}});assert.equal(timers.size,1,'audio focus must not stop the carousel');await get('#cinema-sound').fire('click');assert.equal(timers.size,1,'playing soundtrack keeps automatic slides scheduled');assert.equal(instance.playCalls,1);assert.equal(instance.paused,false);await get('.cinema-next').fire('click');assert.equal(instance.currentTime,12);assert.equal(get('.cinema-hero').dataset.slide,'1');assert.equal(frames[1].attrs['aria-hidden'],'false');const [advanceId,advance]=[...timers.entries()][0];assert.equal(advance.ms,4000);timers.delete(advanceId);advance.fn();assert.equal(get('.cinema-hero').dataset.slide,'2','timer must auto-advance after four seconds');assert.equal(frames[2].attrs['aria-hidden'],'false');assert.equal(timers.size,1,'auto-advance must schedule the following slide');document.hidden=true;await document.fire('visibilitychange');assert.equal(instance.paused,true);assert.equal(timers.size,0);document.hidden=false;await document.fire('visibilitychange');assert.equal(instance.paused,true);dispose();assert.equal(timers.size,0);assert.equal(get('#cinema-sound').listeners.size,0)}finally{Object.assign(globalThis,saved)}
});
test('home exposes existing participation paths without fake episodes or sponsors',()=>{const html=cinemaHomeMarkup();for(const route of ['#assistir','/ir-alem/','/cliente/#acompanhar','#enviar'])assert.ok(html.includes(route));assert.ok(html.includes('Você chegou no meio da história.'));assert.ok(!html.includes('Em breve'));assert.ok(html.includes('Assistir no YouTube'));assert.ok(html.includes('community-track'));assert.ok(html.includes('cinema-sponsor-content'));assert.ok(!html.includes('Cafeteria do Centro'));assert.ok(!html.includes('autoplay'))});

test('streaming hero CTAs are compact with only participation red and translateX slides restored',async()=>{
 const {readFileSync}=await import('node:fs');
 const css=readFileSync(new URL('../dist/streaming.css',import.meta.url),'utf8');
 const end=css.slice(css.indexOf('/* HOCCO hero controls: compact'));
 assert.match(end,/cinema-actions \.cinema-primary\s*\{\s*background:#252525/);
 assert.match(end,/cinema-actions \.cinema-participation-cta\s*\{\s*background:#d9111b/);
 assert.match(end,/width:auto;max-width:100%;flex:0 1 auto;min-height:42px/);
 assert.match(end,/transform:translateX\(calc\(var\(--slide-offset,1\)\*100%\)\)/);
 assert.match(end,/@media\(max-width:700px\)/);
});
