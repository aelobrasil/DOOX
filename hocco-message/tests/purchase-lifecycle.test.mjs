import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutBlock, isUnpaidCommentExpired, paymentExpiresAt } from '../supabase/functions/hocco-message/purchase-lifecycle.mjs';
import { handler } from '../supabase/functions/hocco-message/index.ts';
import { createPreference } from '../supabase/functions/hocco-message/mercado-pago.mjs';

const now=Date.now(),fresh={created_at:new Date(now-60_000).toISOString(),publication_deadline:new Date(now+86400_000).toISOString(),payment:'pending',review:'approved',price_cents:500};
test('comments expire exactly at 20 minutes; paid records and sponsors do not share that TTL',()=>{
 const row={...fresh,created_at:new Date(now-20*60_000).toISOString()};
 assert.equal(isUnpaidCommentExpired(row,'community',now-1),false);
 assert.equal(isUnpaidCommentExpired(row,'community',now),true);
 assert.equal(isUnpaidCommentExpired({...row,payment:'confirmed'},'community',now),false);
 assert.equal(isUnpaidCommentExpired(row,'sponsor',now),false);
 assert.equal(isUnpaidCommentExpired({...row,payment_hold:true},'community',now),false);
 assert.equal(isUnpaidCommentExpired({...row,mercado_pago_payment_id:'999999'},'community',now),false);
 assert.equal(paymentExpiresAt(row,'community'),new Date(now).toISOString());
});
for(const [label,kind,extra,status] of [
 ['archived video','order',{archived_at:new Date(now).toISOString()},409],
 ['hidden community','community',{hidden_at:new Date(now).toISOString()},409],
 ['late video publication','order',{publication_deadline:new Date(now-1).toISOString()},409],
 ['expired community','community',{created_at:new Date(now-21*60_000).toISOString()},410],
 ['removed purchase','community',{expired_purchase:true},410],
])test(label+' cannot generate a preference or contact the payment provider',async()=>{
 let providerCalls=0;
 const env={get:k=>({SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',MP_ACCESS_TOKEN:'TEST-only'}[k])};
 const fetcher=async(url)=>{const p=new URL(url).pathname;if(p==='/rest/v1/rpc/hm_rate_limit')return Response.json(true);if(p==='/rest/v1/hm_orders'||p==='/rest/v1/hm_community_messages')return Response.json([{...fresh,...extra}]);providerCalls++;throw Error('Provider must not be called')};
 const code=kind==='order'?'HM-26-AABBCCDDEEFF':'HC-CM-AABBCCDDEEFF';
 const res=await handler(new Request('https://test.invalid/',{method:'POST',body:JSON.stringify({action:'payment.checkout',kind,code,trackingToken:'a'.repeat(64)})}),env,fetcher);
 assert.equal(res.status,status);assert.equal(providerCalls,0);assert.ok((await res.json()).error);
});
test('fresh eligible checkout keeps its original 20-minute deadline at Mercado Pago',async()=>{
 let sent;
 const expiresAt=new Date(Date.now()+60_000).toISOString();
 await createPreference({accessToken:'TEST-only',externalReference:'hocco:order:HM-26-AABBCCDDEEFF',title:'Test',priceCents:500,origin:'https://hocco-message.vercel.app',returnPath:'/cliente/',notificationUrl:'https://test.invalid',expiresAt,fetcher:async(_,o)=>{sent=JSON.parse(o.body);return Response.json({id:'test',sandbox_init_point:'https://www.mercadopago.com.br/checkout/test'})}});
 assert.equal(sent.expires,true);assert.equal(sent.expiration_date_to,expiresAt);
 assert.equal(checkoutBlock(fresh,'order',now),null);
});
test('an expired preference is rejected locally without a provider request',async()=>{
 let calls=0;
 await assert.rejects(()=>createPreference({accessToken:'TEST-only',priceCents:500,origin:'https://hocco-message.vercel.app',returnPath:'/',expiresAt:new Date(Date.now()-1).toISOString(),fetcher:async()=>{calls++;throw Error('Unexpected')}}),/prazo/);
 assert.equal(calls,0);
});
