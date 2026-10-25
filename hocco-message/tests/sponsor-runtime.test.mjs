import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as config from '../dist/config.mjs';
const source=await readFile(new URL('../dist/ir-alem/app.mjs',import.meta.url),'utf8');
async function renderSponsor(payment,brokenStorage=false){
 const handlers={},app={innerHTML:'',classList:{remove(){},add(){}}};
 const document={querySelector(selector){if(selector==='#sponsor-app')return app;if(selector==='#refresh-sponsor')return {};if(selector==='#mp-checkout-sponsor'&&app.innerHTML.includes('id="mp-checkout-sponsor"'))return {addEventListener(name,handler){handlers[name]=handler}};return null}};
 const calls=[],location={hash:'#pedido/TEST/private',assign(url){this.assigned=url}};
 const bindings={...config,api:async(action)=>{calls.push(action);if(action==='sponsor.catalog')return {settings:{},active:[]};if(action==='payment.checkout')return {checkoutUrl:'https://www.mercadopago.com.br/checkout/test'};return {sponsor:{code:'TEST',company_name:'Marca de teste',payment,review:'pending',price_cents:2990},contact:{}}}};
 const context=vm.createContext({document,location,sessionStorage:{setItem(){if(brokenStorage)throw Error('Storage denied')}},window:{addEventListener(){}},setInterval(){},setTimeout(){},clearTimeout(){},console});
 // Bind exactly the imports declared by the real module; missing imports stay missing.
 const script=source.replace(/import\{([^}]+)\}from'([^']+)';/g,(_,names,path)=>{assert.equal(path,'/config.mjs');for(const name of names.split(',')){assert.ok(name in bindings,name);context[name]=bindings[name]}return ''});
 vm.runInContext(script,context);await vm.runInContext('render()',context);
 return {app,handlers,location,calls};
}
test('pending sponsor renders checkout without old PIX config and opens checkout',async()=>{const r=await renderSponsor('pending');assert.match(r.app.innerHTML,/id="mp-checkout-sponsor"/);await r.handlers.click({currentTarget:{}});assert.match(r.location.assigned,/mercadopago/);assert.ok(r.calls.includes('payment.checkout'))});
test('confirmed sponsor has curation state without another payment button',async()=>{const r=await renderSponsor('confirmed');assert.match(r.app.innerHTML,/na fila da curadoria/);assert.doesNotMatch(r.app.innerHTML,/id="mp-checkout-sponsor"/)});
test('blocked session storage does not block payment page',async()=>{const r=await renderSponsor('pending',true);assert.match(r.app.innerHTML,/id="mp-checkout-sponsor"/)});
