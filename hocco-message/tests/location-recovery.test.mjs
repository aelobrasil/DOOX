import test from 'node:test';
import assert from 'node:assert/strict';
import {geoSuggestion} from '../api/location.js';
import {handler,validateInput} from '../supabase/functions/hocco-message/index.ts';
import {LEGAL_VERSION} from '../dist/policies.mjs';
test('video customer consent version is accepted by server validation',()=>{
 const input={name:'Participante fictício',message:'Mensagem fictícia para teste.',socialPlatform:'instagram',socialHandle:'teste_hocco',slot:1,legalVersion:LEGAL_VERSION,terms:true,publication:true,adult:true,trackingToken:'a'.repeat(64)};
 assert.equal(validateInput(input).name,input.name);assert.throws(()=>validateInput({...input,legalVersion:'2026-10-20.v6'}));
});
test('community cannot create an order before consent',async()=>{
 const r=await handler(request('community.create',{name:'Teste',username:'teste_hocco',avatar:1,message:'Mensagem fictícia.',trackingToken:'a'.repeat(64)}),env,async url=>{
  if(url.endsWith('/rpc/hm_rate_limit'))return Response.json(true);throw Error('No order write without consent');
 });assert.equal(r.status,409);
});
test('IP city is decoded and restricted to valid Brazilian region',()=>{
 assert.deepEqual(geoSuggestion({'x-vercel-ip-city':'S%C3%A3o%20Paulo','x-vercel-ip-country-region':'SP','x-vercel-ip-country':'BR'}),{city:'São Paulo',uf:'SP',approximate:true});
 for(const h of [{},{'x-vercel-ip-city':'X%','x-vercel-ip-country-region':'SP','x-vercel-ip-country':'BR'},{'x-vercel-ip-city':'London','x-vercel-ip-country-region':'SP','x-vercel-ip-country':'GB'},{'x-vercel-ip-city':'Bauru','x-vercel-ip-country-region':'XX','x-vercel-ip-country':'BR'}])assert.equal(geoSuggestion(h),null);
});
const env={get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'fictitious-service',MP_ACCESS_TOKEN:'fictitious-token',MP_ENVIRONMENT:'test'}[k])};
function request(action,body={}){return new Request('https://app.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...body})})}
for(const action of ['admin.geo','admin.geo.mutate','admin.reconciliation'])test(action+' requires authenticated team',async()=>{
 let calls=0;const r=await handler(request(action),env,async()=>{calls++;throw Error('No unauthenticated database access')});assert.equal(r.status,401);assert.equal(calls,0);
});
test('scheduled reconciliation rejects unauthorized callers before claiming jobs',async()=>{
 const calls=[];const r=await handler(request('maintenance.reconcile'),env,async url=>{calls.push(url);assert.match(url,/rpc\/hm_server_authorize$/);return Response.json(false)});assert.equal(r.status,401);assert.equal(calls.length,1);
});
test('scheduled reconciliation queries provider and applies verified payment without customer visit',async()=>{
 let confirmed=false;const writes=[];
 const fetcher=async(url,o={})=>{
  if(url.endsWith('rpc/hm_server_authorize'))return Response.json(true);
  if(url.endsWith('rpc/hm_refresh_city_markets'))return Response.json(null);
  if(url.endsWith('rpc/hm_claim_reconciliation'))return Response.json([{kind:'community',code:'HC-CM-AABBCCDDEEFF',lease:'11111111-1111-4111-8111-111111111111'}]);
  if(url.includes('/hm_community_messages?'))return Response.json([{id:'22222222-2222-4222-8222-222222222222',code:'HC-CM-AABBCCDDEEFF',price_cents:350,payment:confirmed?'confirmed':'pending'}]);
  if(url.includes('/v1/payments/search?'))return Response.json({results:[{id:999888,status:'approved',external_reference:'hocco:community:HC-CM-AABBCCDDEEFF',currency_id:'BRL',transaction_amount:3.5,collector_id:42,live_mode:false,date_last_updated:'2026-10-27T12:00:00Z'}]});
  if(url.endsWith('/users/me'))return Response.json({id:42});
  if(url.endsWith('rpc/hm_apply_verified_payment')){confirmed=true;writes.push(JSON.parse(o.body));return Response.json({updated:true})}
  if(url.endsWith('rpc/hm_finish_reconciliation')){writes.push(JSON.parse(o.body));return Response.json(null)}
  throw Error('Unexpected isolated call '+url);
 };
 const r=await handler(request('maintenance.reconcile'),env,fetcher);assert.equal(r.status,200);assert.equal((await r.json()).completed,1);assert.equal(writes[0].p_status,'approved');assert.equal(writes[1].p_done,true);
});
test('scheduled reconciliation records provider failure without confirming payment',async()=>{
 let finish;
 const r=await handler(request('maintenance.reconcile'),env,async(url,o={})=>{
  if(url.endsWith('rpc/hm_server_authorize'))return Response.json(true);
  if(url.endsWith('rpc/hm_refresh_city_markets'))return Response.json(null);
  if(url.endsWith('rpc/hm_claim_reconciliation'))return Response.json([{kind:'sponsor',code:'HC-SP-AABBCCDDEEFF',lease:'11111111-1111-4111-8111-111111111111'}]);
  if(url.includes('/hm_sponsors?'))return Response.json([{code:'HC-SP-AABBCCDDEEFF',price_cents:6990,payment:'pending'}]);
  if(url.includes('/v1/payments/search?'))return Response.json({error:'fictitious outage'},{status:503});
  if(url.endsWith('rpc/hm_finish_reconciliation')){finish=JSON.parse(o.body);return Response.json(null)}
  throw Error('Unexpected call '+url);
 });assert.equal(r.status,200);assert.equal((await r.json()).failed,1);assert.equal(finish.p_done,false);assert.ok(finish.p_error);
});
