import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handler} from '../supabase/functions/hocco-message/index.ts';
import {createScenario,transitionScenario} from '../supabase/functions/hocco-lab/engine.mjs';
import {paymentState} from '../dist/payment-state.mjs';

// All dependencies are injected. No request can leave this test process.
const secret='fictitious-audit-secret';
const codes={community:'HC-CM-AABBCCDDEEFF',order:'HM-26-AABBCCDDEEFF',sponsor:'HC-SP-AABBCCDDEEFF'};
const tables={community:'hm_community_messages',order:'hm_orders',sponsor:'hm_sponsors'};
const env={get:k=>({SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'fictitious-only',MP_ACCESS_TOKEN:'fictitious-only',MP_WEBHOOK_SECRET:secret,MP_ENVIRONMENT:'test'}[k])};
async function notification(kind,overrides={},options={}){
 const id='999888777',requestId='isolated-audit',ts='1793100000';
 const digest=createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
 const req=new Request('https://app.invalid/hook?type=payment',{method:'POST',headers:{'content-type':'application/json','x-request-id':requestId,'x-signature':`ts=${ts},v1=${options.forged?'0'.repeat(64):digest}`},body:JSON.stringify({type:'payment',data:{id}})});
 const events=[],writes=[];
 const fetcher=async(url,opts={})=>{
  const parsed=new URL(url);
  if(parsed.hostname==='api.mercadopago.com'&&parsed.pathname==='/v1/payments/'+id){
   if(options.lookupStatus)return Response.json({error:'simulated_error'},{status:options.lookupStatus});
   return Response.json({id,status:'approved',external_reference:`hocco:${kind}:${codes[kind]}`,currency_id:'BRL',transaction_amount:kind==='sponsor'?69.90:kind==='order'?5:3.50,collector_id:42,live_mode:false,date_last_updated:'2026-10-27T12:00:00Z',...overrides});
  }
  if(parsed.hostname==='api.mercadopago.com'&&parsed.pathname==='/users/me')return Response.json({id:42});
  if(parsed.hostname==='database.invalid'&&parsed.pathname==='/rest/v1/'+tables[kind])return Response.json(options.missing?[]:[{id:'11111111-1111-4111-8111-111111111111',code:codes[kind],price_cents:kind==='sponsor'?6990:kind==='order'?500:350,payment:'pending'}]);
  if(parsed.hostname==='database.invalid'&&parsed.pathname==='/rest/v1/rpc/hm_apply_verified_payment'){
   writes.push(url);events.push(JSON.parse(opts.body));
   return options.databaseFailure?Response.json({message:'simulated database unavailable'},{status:503}):Response.json({received:true,updated:true});
  }
  throw Error('Unexpected isolated request: '+parsed.origin+parsed.pathname);
 };
 const response=await handler(req,env,fetcher);
 return {status:response.status,body:await response.json(),events,writes};
}
for(const kind of Object.keys(codes)){
 for(const status of ['approved','refunded','charged_back','in_mediation'])test(`audit webhook ${kind}: ${status} routes to verified atomic operation`,async()=>{
  const r=await notification(kind,{status});assert.equal(r.status,200);assert.equal(r.events.length,1);assert.equal(r.events[0].p_kind,kind);assert.equal(r.events[0].p_status,status);assert.equal(r.events[0].p_code,codes[kind]);
 });
 for(const status of ['pending','rejected','cancelled','in_process'])test(`audit webhook ${kind}: ${status} cannot release payment`,async()=>{
  const r=await notification(kind,{status});assert.equal(r.status,200);assert.equal(r.events.length,0);
 });
 for(const [field,value] of Object.entries({transaction_amount:0.01,currency_id:'USD',collector_id:99,live_mode:true}))test(`audit webhook ${kind}: mismatched ${field} never writes`,async()=>{
  const r=await notification(kind,{[field]:value});assert.notEqual(r.status,200);assert.equal(r.events.length,0);
 });
 test(`audit webhook ${kind}: forged signature cannot write`,async()=>{const r=await notification(kind,{}, {forged:true});assert.equal(r.status,401);assert.equal(r.events.length,0)});
 test(`audit webhook ${kind}: unknown order cannot write`,async()=>{const r=await notification(kind,{}, {missing:true});assert.equal(r.status,200);assert.equal(r.events.length,0)});
}
test('audit provider failure is retryable and cannot acknowledge a payment',async()=>{const r=await notification('community',{}, {lookupStatus:503});assert.equal(r.status,502);assert.equal(r.events.length,0)});
test('audit dashboard fictitious missing payment cannot confirm an order',async()=>{const r=await notification('community',{}, {lookupStatus:404});assert.equal(r.status,200);assert.equal(r.body.ignored,true);assert.equal(r.events.length,0)});
test('audit failed database write does not announce confirmed payment',async()=>{const r=await notification('community',{}, {databaseFailure:true});assert.notEqual(r.status,200);assert.equal(r.body.updated,undefined)});
const now=Date.parse('2026-10-27T12:00:00Z');
for(const kind of ['community','live','video','sponsor'])test(`audit laboratory ${kind}: unpaid, paid and refund presentation`,()=>{
 const s=createScenario(kind,'Mensagem fictícia para auditoria',now);
 assert.equal(s.published_at,null);assert.equal(paymentState(s,kind,now).state,'pending');
 const paid=transitionScenario(s,'pay',now);
 if(kind==='sponsor'){
  assert.equal(paid.review,'pending');assert.equal(paid.published_at,null);assert.equal(paymentState(paid,kind,now).state,'review');
 }else if(kind==='video'){
  assert.equal(paid.delivery,'pending');assert.equal(paid.published_at,null);assert.equal(paymentState(paid,kind,now).state,'queued');
 }else{
  assert.equal(paid.published_at,new Date(now).toISOString());assert.equal(Date.parse(paid.expires_at)-now,(kind==='live'?24:4)*3600000);
 }
 const duplicate=transitionScenario(paid,'pay',now+60000);assert.equal(duplicate.expires_at,paid.expires_at);
 const refunded=transitionScenario(paid,'refund',now+120000);assert.equal(refunded.payment,'refunded');assert.equal(refunded.published_at,null);assert.equal(paymentState(refunded,kind,now+120000).state,'refunded');
 assert.throws(()=>transitionScenario(refunded,'pay',now+180000));
});
test('audit laboratory sponsor: payment then human approval starts seven days',()=>{
 const s=createScenario('sponsor','Empresa fictícia',now);assert.throws(()=>transitionScenario(s,'approve',now));
 const paid=transitionScenario(s,'pay',now),active=transitionScenario(paid,'approve',now+3600000);
 assert.equal(Date.parse(active.published_at),now+3600000);assert.equal(Date.parse(active.expires_at)-Date.parse(active.published_at),168*3600000);
});
test('audit laboratory video: delivery requires payment and manual publication',()=>{
 const s=createScenario('video','Mensagem fictícia',now);assert.throws(()=>transitionScenario(s,'publish_video',now));
 const paid=transitionScenario(s,'pay',now),published=transitionScenario(paid,'publish_video',now+3600000);assert.equal(published.delivery,'published');
});
test('audit laboratory live: reading requires payment and updates presentation',()=>{
 const s=createScenario('live','Mensagem fictícia',now);assert.throws(()=>transitionScenario(s,'read',now));
 const paid=transitionScenario(s,'pay',now),read=transitionScenario(paid,'read',now+3600000);assert.equal(paymentState(read,'live',now+3600000).state,'read');
});
