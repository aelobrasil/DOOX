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
 const frames=cinemaSlides.map(()=>new El()),slides=cinemaSlides.map((_,i)=>Object.assign(new El(),{dataset:{cinemaSlide:String(i)}}));const root={querySelector:get,querySelectorAll:s=>s==='.cinema-frame'?frames:s==='[data-cinema-slide]'?slides:[]};
 try{const dispose=mountCinema(root,{participate(){},reducedMotion:()=>false});assert.equal(instance.playCalls,0);assert.equal(timers.size,1);await get('#cinema-sound').fire('click');assert.equal(instance.playCalls,1);assert.equal(instance.paused,false);await get('.cinema-next').fire('click');assert.equal(instance.currentTime,12);assert.equal(get('.cinema-hero').dataset.slide,'0');const swap=[...timers].find(([,t])=>t.ms===500);assert.ok(swap,'image change waits for the dimming phase');timers.delete(swap[0]);swap[1].fn();assert.equal(get('.cinema-hero').dataset.slide,'1');document.hidden=true;await document.fire('visibilitychange');assert.equal(instance.paused,true);assert.equal(timers.size,0);document.hidden=false;await document.fire('visibilitychange');assert.equal(instance.paused,true);dispose();assert.equal(timers.size,0);assert.equal(get('#cinema-sound').listeners.size,0)}finally{Object.assign(globalThis,saved)}
});
test('home exposes existing participation paths without fake episodes or sponsors',()=>{const html=cinemaHomeMarkup();for(const route of ['#assistir','/ir-alem/','/cliente/#acompanhar','#enviar'])assert.ok(html.includes(route));assert.ok(html.includes('Você chegou no meio da história.'));assert.ok(!html.includes('Em breve'));assert.ok(html.includes('Assistir no YouTube'));assert.ok(html.includes('community-track'));assert.ok(html.includes('cinema-sponsor-content'));assert.ok(!html.includes('Cafeteria do Centro'));assert.ok(!html.includes('autoplay'))});
