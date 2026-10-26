import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../supabase/functions/hocco-message/index.ts';
const id='11111111-1111-4111-8111-111111111111';
async function request(body,auth=true,member=true){
 const writes=[];
 const env={get:k=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test-only'}[k])};
 const fetcher=async(url,o={})=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id,email_confirmed_at:'2026-01-01'});
  if(url.includes('/hm_team_members?'))return Response.json(member?[{user_id:id}]:[]);
  if(o.method!=='GET'){writes.push({url,body:JSON.parse(o.body)});return Response.json({ok:true});}
  throw Error('Unexpected request');
 };
 const res=await handler(new Request('https://api.test/',{method:'POST',headers:{'content-type':'application/json',...(auth?{Authorization:'Bearer test'}:{})},body:JSON.stringify(body)}),env,fetcher);
 return {res,writes};
}
test('anonymous archive is rejected without writes',async()=>{const r=await request({action:'admin.records.archive_one',type:'sponsor',id,reason:'Teste'},false);assert.equal(r.res.status,401);assert.equal(r.writes.length,0)});
test('non-team archive is rejected without writes',async()=>{const r=await request({action:'admin.records.archive_one',type:'sponsor',id,reason:'Teste'},true,false);assert.equal(r.res.status,403);assert.equal(r.writes.length,0)});
test('legacy permanent deletion cannot delete records or images',async()=>{const r=await request({action:'admin.sponsor.delete',id,confirmName:'Teste'});assert.equal(r.res.status,409);assert.equal(r.writes.length,0)});
test('archive requires a reason',async()=>{const r=await request({action:'admin.records.archive_one',type:'sponsor',id,reason:''});assert.notEqual(r.res.status,200);assert.equal(r.writes.length,0)});
test('archive is delegated to one atomic audited RPC',async()=>{const r=await request({action:'admin.records.archive_one',type:'sponsor',id,reason:'Marca solicitou retirada'});assert.equal(r.res.status,200);assert.equal(r.writes.length,1);assert.ok(r.writes[0].url.endsWith('/rpc/hm_archive_record'));assert.equal(r.writes[0].body.p_actor,id);assert.equal(r.writes[0].body.p_reason,'Marca solicitou retirada')});
