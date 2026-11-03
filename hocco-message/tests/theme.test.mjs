import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/theme.js',import.meta.url),'utf8');
function boot(saved,{blocked=false}={}){
 const callbacks={},buttons=[],root={dataset:{},style:{}},meta={setAttribute(k,v){this[k]=v}},storage={value:saved};
 const header={querySelector(){return null},insertBefore(el){buttons.push(el)}};
 const document={documentElement:root,readyState:'complete',querySelector(s){return s==='#theme-toggle'?buttons[0]||null:s==='body>header'?header:s.startsWith('meta')?meta:null},createElement(){return {attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this[k]=fn}}}};
 const localStorage={getItem(){if(blocked)throw Error();return storage.value},setItem(k,v){if(blocked)throw Error();storage.value=v}};
 vm.runInNewContext(source,{document,localStorage,window:{addEventListener(k,fn){callbacks[k]=fn}}});
 return{root,meta,storage,button:buttons[0],callbacks};
}
test('saved theme restores before page content, toggles accessibly and persists',()=>{
 const r=boot('light');assert.equal(r.root.dataset.theme,'light');assert.equal(r.meta.content,'#f7f5f1');assert.equal(r.button.attributes['aria-label'],'Ativar tema escuro');
 r.button.click();assert.equal(r.storage.value,'dark');assert.equal(r.root.dataset.theme,'dark');assert.equal(r.button.attributes['aria-pressed'],'false');
 assert.equal(boot(r.storage.value).root.dataset.theme,'dark');
 r.storage.value='light';r.callbacks.storage({key:'hocco-theme'});assert.equal(r.root.dataset.theme,'light');
});
test('blocked browser storage still permits changing the current page theme',()=>{const r=boot('light',{blocked:true});assert.equal(r.root.dataset.theme,'dark');r.button.click();assert.equal(r.root.dataset.theme,'light')});
