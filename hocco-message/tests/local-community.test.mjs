import test from 'node:test';import assert from 'node:assert/strict';
import {validateLocation,validateProgramming} from '../supabase/functions/hocco-message/local-community.mjs';
import {createScenario,transitionScenario} from '../supabase/functions/hocco-lab/engine.mjs';
import {handler as labHandler} from '../supabase/functions/hocco-lab/index.ts';
test('Brazilian city/UF normalized without GPS',()=>{assert.deepEqual(validateLocation({city:'  São   Paulo ',stateCode:'sp'}),{city:'São Paulo',state_code:'SP',offer_conditions:'',offer_expires_on:null})});
for(const v of [{city:'Bauru',stateCode:'XX'},{city:'<script>',stateCode:'SP'},{city:'Bauru',stateCode:'SP',offerEnabled:true},{city:'Bauru',stateCode:'SP',offerExpiresOn:'2026-02-30'}])test('invalid location/offer rejected '+JSON.stringify(v),()=>assert.throws(()=>validateLocation(v)));
test('closed live may have no date; open live must have future schedule',()=>{assert.equal(validateProgramming({capacity:10,accepting:false}).accepting,false);assert.throws(()=>validateProgramming({capacity:10,accepting:true}));assert.equal(validateProgramming({capacity:10,accepting:true,liveTitle:'Conversa HOCCO',liveAt:new Date(Date.now()+86400000).toISOString()}).capacity,10)});
for(const kind of ['community','live','video','sponsor'])test(kind+' laboratory never publishes unpaid',()=>{const s=createScenario(kind,'Que bom participar da HOCCO!');assert.equal(s.published_at,null);assert.equal(s.payment,'pending')});
test('paid sponsor still waits for curation',()=>{let s=transitionScenario(createScenario('sponsor','Teste de patrocínio'),'pay');assert.equal(s.published_at,null);s=transitionScenario(s,'approve');assert.ok(s.published_at);assert.equal(Date.parse(s.expires_at)-Date.parse(s.published_at),7*86400000)});
test('duplicate simulated payment does not extend message',()=>{let s=transitionScenario(createScenario('community','Bom acompanhar a HOCCO!'),'pay',Date.now());const expiry=s.expires_at;s=transitionScenario(s,'pay',Date.now()+100000);assert.equal(s.expires_at,expiry);assert.equal(transitionScenario(s,'refund').published_at,null)});
test('lab refuses any production environment before using network',async()=>{let calls=0;const r=await labHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer x'},body:'{}'}),{get:()=> 'https://vebqvedmhfaebvdantiu.supabase.co'},async()=>{calls++;throw Error()});assert.equal(r.status,503);assert.equal(calls,0)});
test('lab requires a team session',async()=>{const r=await labHandler(new Request('https://example.test',{method:'POST',body:'{}'}),{get:()=> 'https://lssfoyzhxdfekuqxwyxy.supabase.co'});assert.equal(r.status,401)});
test('lab rejects non-team session without sandbox calls',async()=>{const calls=[];const r=await labHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer x'},body:'{}'}),{get:()=> 'https://lssfoyzhxdfekuqxwyxy.supabase.co'},async u=>{calls.push(u);return Response.json({error:'Denied'},{status:403})});assert.equal(r.status,403);assert.equal(calls.length,1);assert.ok(calls[0].includes('vebqvedmhfaebvdantiu'))});
test('sandbox creation stores owner from verified session, never client actor',async()=>{
 const writes=[],uid='11111111-1111-4111-8111-111111111111';
 const env={get:k=>k==='SUPABASE_URL'?'https://lssfoyzhxdfekuqxwyxy.supabase.co':k==='SUPABASE_SERVICE_ROLE_KEY'?'test-only':undefined};
 const fetcher=async(u,o={})=>{if(u.includes('vebqvedmhfaebvdantiu'))return Response.json({ok:true,actorId:uid});if(o.method==='POST'){const b=JSON.parse(o.body);writes.push(b);return Response.json([{id:uid,...b}])}return Response.json([])};
 const r=await labHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer x'},body:JSON.stringify({action:'lab.create',kind:'community',message:'Participação fictícia',actorId:'attacker'})}),env,fetcher);
 assert.equal(r.status,201);assert.equal(writes[0].actor_id,uid);assert.equal(writes[0].payload.simulation,true);
});
test('sandbox reads always filter verified owner',async()=>{
 const calls=[],uid='11111111-1111-4111-8111-111111111111',env={get:k=>k==='SUPABASE_URL'?'https://lssfoyzhxdfekuqxwyxy.supabase.co':k==='SUPABASE_SERVICE_ROLE_KEY'?'test-only':undefined};
 const r=await labHandler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer x'},body:JSON.stringify({action:'lab.list'})}),env,async u=>{calls.push(u);return u.includes('vebqvedmhfaebvdantiu')?Response.json({ok:true,actorId:uid}):Response.json([])});
 assert.equal(r.status,200);assert.ok(calls[1].includes('actor_id=eq.'+uid));assert.ok(calls[1].startsWith('https://lssfoyzhxdfekuqxwyxy.supabase.co/rest/v1/hm_lab_scenarios'));
});
