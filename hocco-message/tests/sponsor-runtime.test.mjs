import {normalizeTrackingHash} from '../dist/tracking-progress.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as config from '../dist/config.mjs';
import * as purchaseDraft from '../dist/purchase-draft.mjs';
const source=await readFile(new URL('../dist/ir-alem/app.mjs',import.meta.url),'utf8');
async function renderSponsor(payment,brokenStorage=false,page='pedido',navigateDuringLookup=false,review=payment==='pending'?'approved':'pending'){
 const intervals=[];const handlers={},app={innerHTML:'',classList:{remove(){},add(){}}};
 const document={body:{classList:{toggle(){}}},querySelector(selector){if(selector==='#sponsor-app')return app;if(selector==='#refresh-sponsor')return {};if(selector==='#mp-checkout-sponsor'&&app.innerHTML.includes('id="mp-checkout-sponsor"'))return {addEventListener(name,handler){handlers[name]=handler}};return page==='novo'?{addEventListener(){}}:null}};
 const calls=[],location={hash:page==='novo'?'#novo':'#pedido/TEST/private',assign(url){this.assigned=url}};
 const bindings={mountReturnActivity(){},normalizeTrackingHash,mountSponsorWizard(){},mountSponsorPix(){},...config,...purchaseDraft,suggestCity:async()=>null,api:async(action)=>{calls.push(action);if(action==='sponsor.catalog')return {settings:{price_cents:1990,enabled:true},cities:[],active:[]};if(action==='payment.checkout')return {checkoutUrl:'https://www.mercadopago.com.br/checkout/test'};if(navigateDuringLookup)location.hash='#novo';return {sponsor:{code:'TEST',company_name:'Marca de teste',payment,review,price_cents:2990},contact:{}}}};
 const context=vm.createContext({document,location,sessionStorage:{setItem(){if(brokenStorage)throw Error('Storage denied')}},window:{addEventListener(){}},setInterval(fn,ms){intervals.push({fn,ms})},setTimeout(){},clearTimeout(){},clearInterval(){},console});
 // Bind exactly the imports declared by the real module; missing imports stay missing.
 const script=source.replace(/import\s*\{([^}]+)\}\s*from\s*'([^']+)';/g,(_,names,path)=>{assert.ok(['/config.mjs','/location.mjs','/purchase-draft.mjs','/sponsor-wizard.mjs','/pix-checkout.mjs','/tracking-progress.mjs','/reactivation.mjs'].includes(path));for(const raw of names.split(',')){const name=raw.trim();assert.ok(name in bindings,name);context[name]=bindings[name]}return ''});
 await vm.runInContext('(async()=>{'+script+';await render()})()',context);
 return {app,handlers,location,calls,intervals};
}
test('pending sponsor renders checkout without old PIX config and opens checkout',async()=>{const r=await renderSponsor('pending');assert.match(r.app.innerHTML,/id="mp-checkout-sponsor"/);await r.handlers.click({currentTarget:{}});assert.match(r.location.assigned,/mercadopago/);assert.ok(r.calls.includes('payment.checkout'))});
test('confirmed sponsor has curation state without another payment button',async()=>{const r=await renderSponsor('confirmed');assert.match(r.app.innerHTML,/na fila da curadoria/);assert.doesNotMatch(r.app.innerHTML,/id="mp-checkout-sponsor"/)});
test('blocked session storage does not block payment page',async()=>{const r=await renderSponsor('pending',true);assert.match(r.app.innerHTML,/id="mp-checkout-sponsor"/)});

test('national registration renders the complete form even without open city markets',async()=>{const r=await renderSponsor('pending',false,'novo');assert.match(r.app.innerHTML,/id="sponsor-form"/);assert.match(r.app.innerHTML,/todo o Brasil/);for(const id of ['sponsor-city','sponsor-state','sponsor-cnpj','sponsor-logo','sponsor-cover','sponsor-submit'])assert.ok(r.app.innerHTML.includes('id="'+id+'"'));assert.doesNotMatch(r.app.innerHTML,/Novas cidades em breve/)});

test('background sponsor checks preserve the payment screen when facts did not change',async()=>{const r=await renderSponsor('pending'),html=r.app.innerHTML,calls=r.calls.length;await r.intervals.find(x=>x.ms===30000).fn();assert.equal(r.calls.length,calls);assert.equal(r.app.innerHTML,html);await r.intervals.find(x=>x.ms===3000).fn();assert.equal(r.app.innerHTML,html)});
test('a late private sponsor lookup cannot replace a different route',async()=>{const r=await renderSponsor('pending',false,'pedido',true);assert.equal(r.location.hash,'#novo');assert.doesNotMatch(r.app.innerHTML,/Marca de teste/)});

test('unapproved sponsor is in review and cannot open checkout',async()=>{const r=await renderSponsor('pending',false,'pedido',false,'pending');assert.match(r.app.innerHTML,/Solicitação enviada para análise/);assert.doesNotMatch(r.app.innerHTML,/id="mp-checkout-sponsor"/)});
