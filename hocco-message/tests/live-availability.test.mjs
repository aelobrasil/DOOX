import test from 'node:test';import assert from 'node:assert/strict';
import {canSendLive,liveScheduleLabel} from '../dist/live-availability.mjs';
import {handler} from '../supabase/functions/hocco-message/index.ts';
const settings={live_enabled:true},queue={live_accepting:true,available:10,next_live_at:null};
test('LIVE accepts an undated next-broadcast queue and has no capacity limit and respects deliberate pauses',()=>{
 assert.equal(canSendLive(settings,queue),true);assert.match(liveScheduleLabel(queue),/data a confirmar/);
 for(const p of [{...queue,available:0},{...queue,available:null},{...queue,next_live_at:'2020-01-01'}])assert.equal(canSendLive(settings,p),true);assert.equal(canSendLive(settings,{...queue,live_accepting:false}),false);
 assert.equal(canSendLive({live_enabled:false},queue),false);assert.equal(canSendLive(null,queue),false);
});
test('undated LIVE checkout reaches Mercado Pago without depending on the previous broadcast date',async()=>{
 for(const scheduled of [null,'2020-01-01']){
  let providerCalls=0;
  const row={id:'00000000-0000-4000-8000-000000000001',code:'HC-CM-AABBCCDDEEFF',created_at:new Date().toISOString(),destination:'live',live_scheduled_at:scheduled,payment:'pending',review:'approved',price_cents:500};
  const env={get:k=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',MP_ACCESS_TOKEN:'TEST-only'})[k]};
  const fetcher=async(url)=>{if(String(url).includes('api.mercadopago.com')){providerCalls++;return Response.json({id:'test',sandbox_init_point:'https://www.mercadopago.com.br/checkout/test',init_point:'https://www.mercadopago.com.br/checkout/test'})}return Response.json([row])};
  const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'payment.checkout',kind:'community',code:row.code,trackingToken:'a'.repeat(64)})}),env,fetcher);
  assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(providerCalls,1);
 }
});
