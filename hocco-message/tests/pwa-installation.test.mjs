import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/pwa.mjs',import.meta.url),'utf8');
test('all customer entry pages load installation logic and the shared manifest',async()=>{
 for(const page of ['index.html','cliente/index.html','ir-alem/index.html']){
  const html=await readFile(new URL('../dist/'+page,import.meta.url),'utf8');
  assert.match(html,/src="\/pwa\.mjs"/,page);assert.match(html,/rel="manifest" href="\/manifest\.webmanifest"/,page);
 }
 const control=await readFile(new URL('../dist/controle/index.html',import.meta.url),'utf8');assert.match(control,/rel="manifest" href="\/controle\/manifest\.webmanifest"/);
});
async function boot({control=false,remembered=false,standalone=false,related=[],blockedStorage=false}={}){
 const events={},docEvents={},values=new Map(),observers=[];
 const key=control?'hocco-control-installed':'hocco-message-installed';if(remembered)values.set(key,'true');
 const element=()=>({removed:false,hidden:true,textContent:'Baixar app',remove(){this.removed=true},setAttribute(){}});
 let button=element(),help=element();
 const media={matches:standalone,addEventListener(name,fn){events['media:'+name]=fn}};
 const navigator={standalone:false,userAgent:'Test Browser',getInstalledRelatedApps:async()=>related};
 const document={body:{},querySelector:s=>s==='#install-app'&&!button.removed?button:s==='#install-help'&&!help.removed?help:null,querySelectorAll:()=>[button,help].filter(x=>!x.removed),addEventListener(name,fn){docEvents[name]=fn}};
 const context=vm.createContext({document,navigator,location:{pathname:control?'/controle/':'/',origin:'https://hocco-message.vercel.app'},URL,window:{navigator,matchMedia:()=>media,addEventListener(name,fn){events[name]=fn}},localStorage:{getItem(k){if(blockedStorage)throw Error('Storage denied');return values.get(k)||null},setItem(k,v){if(blockedStorage)throw Error('Storage denied');values.set(k,v)}},MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}}});
 vm.runInContext(source,context);await new Promise(setImmediate);
 return {events,docEvents,values,key,get button(){return button},get help(){return help},reinsert(){button=element();help=element();observers.forEach(fn=>fn())}};
}
test('installed app remembered in this browser removes installation CTA and help',async()=>{const r=await boot({remembered:true});assert.equal(r.button.removed,true);assert.equal(r.help.removed,true)});
test('appinstalled persists state and removes a reinserted CTA after navigation',async()=>{const r=await boot();r.events.appinstalled();assert.equal(r.values.get(r.key),'true');assert.equal(r.button.removed,true);r.reinsert();assert.equal(r.button.removed,true);assert.equal(r.help.removed,true)});
test('accepted native installation hides the CTA',async()=>{
 const r=await boot();let prompted=false;
 r.events.beforeinstallprompt({preventDefault(){},async prompt(){prompted=true},userChoice:Promise.resolve({outcome:'accepted'})});
 await r.docEvents.click({target:{closest:()=>r.button}});assert.equal(prompted,true);assert.equal(r.button.removed,true);
});
test('standalone display hides installation CTA even without saved state',async()=>{const r=await boot({standalone:true});assert.equal(r.button.removed,true)});
test('supported installed-app lookup recognizes this PWA',async()=>{const r=await boot({related:[{platform:'webapp',id:'https://hocco-message.vercel.app/'}]});assert.equal(r.button.removed,true)});
test('customer installation does not hide the separate control installation',async()=>{const r=await boot({control:true,related:[{platform:'webapp',id:'https://hocco-message.vercel.app/',url:'https://hocco-message.vercel.app/manifest.webmanifest'}]});assert.equal(r.button.removed,false);r.events.appinstalled();assert.equal(r.values.get('hocco-control-installed'),'true');assert.equal(r.values.get('hocco-message-installed'),undefined)});
test('installation event still hides CTA when local storage is unavailable',async()=>{const r=await boot({blockedStorage:true});r.events.appinstalled();r.reinsert();assert.equal(r.button.removed,true)});
