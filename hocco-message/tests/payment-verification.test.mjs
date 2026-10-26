import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedPaymentEvent} from '../supabase/functions/hocco-message/payment-verification.mjs';
import {handler} from '../supabase/functions/hocco-message/index.ts';
import {createHmac} from 'node:crypto';
const opts={kind:'community',code:'HC-CM-ABCDEF123456',priceCents:350,collectorId:42,production:true};
const payment={id:123456789,status:'approved',external_reference:'hocco:community:HC-CM-ABCDEF123456',currency_id:'BRL',transaction_amount:3.50,collector_id:42,live_mode:true,date_last_updated:'2026-10-25T12:00:00Z'};
for(const status of ['approved','refunded','charged_back','in_mediation'])test('verified event '+status,()=>assert.equal(verifiedPaymentEvent({...payment,status},opts).p_status,status));
for(const [name,value] of Object.entries({id:'bad',external_reference:'hocco:sponsor:OTHER',currency_id:'USD',transaction_amount:0.01,collector_id:43,live_mode:false,date_last_updated:'bad'}))test('reject mismatch '+name,()=>assert.throws(()=>verifiedPaymentEvent({...payment,[name]:value},opts)));
test('pending never confirms',()=>assert.equal(verifiedPaymentEvent({...payment,status:'pending'},opts),null));
async function webhook(overrides={},validSignature=true){
 const id=String(payment.id),rid='test-request',ts='1792929600',secret='local-test-secret',digest=createHmac('sha256',secret).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex');
 const req=new Request('https://example.test/hocco-message?type=payment',{method:'POST',headers:{'content-type':'application/json','x-request-id':rid,'x-signature':`ts=${ts},v1=${validSignature?digest:'0'.repeat(64)}`},body:JSON.stringify({data:{id}})});
 const calls=[];const env={get:key=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'local-only',MP_ACCESS_TOKEN:'local-only',MP_WEBHOOK_SECRET:secret,MP_ENVIRONMENT:'production'}[key])};
 const fetcher=async(url,options={})=>{calls.push({url,body:options.body});if(url.includes('/v1/payments/'))return Response.json({...payment,...overrides});if(url.endsWith('/users/me'))return Response.json({id:42});if(url.includes('/hm_community_messages?'))return Response.json([{id:'11111111-1111-4111-8111-111111111111',code:opts.code,price_cents:350,payment:'pending'}]);if(url.endsWith('/rpc/hm_apply_verified_payment'))return Response.json({received:true,updated:true});throw Error('Unexpected request '+url)};
 return {response:await handler(req,env,fetcher),calls};
}
test('signed webhook confirms exclusively through atomic RPC',async()=>{const {response,calls}=await webhook();assert.equal(response.status,200);const write=calls.find(x=>x.url.endsWith('/rpc/hm_apply_verified_payment'));assert.equal(JSON.parse(write.body).p_status,'approved');assert.equal(calls.filter(x=>x.body).length,1)});
test('forged webhook cannot reach payment or database',async()=>{const r=await webhook({},false);assert.equal(r.response.status,401);assert.equal(r.calls.length,0)});
test('wrong receiver never writes confirmation',async()=>{const r=await webhook({collector_id:99});assert.notEqual(r.response.status,200);assert.equal(r.calls.filter(x=>x.body).length,0)});
test('refund notification reaches atomic RPC',async()=>{const r=await webhook({status:'refunded'});assert.equal(r.response.status,200);assert.equal(JSON.parse(r.calls.find(x=>x.body).body).p_status,'refunded')});
