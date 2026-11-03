import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../supabase/functions/hocco-message/index.ts';
const env={get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-service'}[k])};
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh8sAAAAASUVORK5CYII=';
const payload={action:'sponsor.create',companyName:'Empresa teste',legalName:'Empresa de teste limitada',cnpj:'11222333000181',category:'Serviços',companyDescription:'Serviços para empresas e pessoas da cidade.',contactName:'Teste',email:'teste@example.com',city:'Bauru',stateCode:'SP',destinationUrl:'https://example.com',trackingToken:'a'.repeat(64),terms:true,publication:true,sponsorTermsVersion:'2026-11-03.patrocinio.v4',logoMime:'image/png',coverMime:'image/png',logoBase64:image,coverBase64:image,expectedPrice:1990};
async function run(mode,body=payload){let saved=mode==='existing'?{id:'old',code:'HC-SP-AAAAAAAAAAAA',logo_url:'https://old/logo',cover_url:'https://old/cover'}:null;const uploads=[],deletes=[];let lookup=0;
 const response=await handler(new Request('https://app.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),env,async(url,o={})=>{
  if(url.endsWith('/rpc/hm_rate_limit'))return Response.json(true);
  if(url.includes('/hm_sponsor_settings?'))return Response.json([{enabled:true,price_cents:1990}]);
  if(url.includes('/hm_sponsors?tracking_hash=')){lookup++;if(mode==='uncertain'&&lookup>1)throw Error('database unavailable');return Response.json(saved?[saved]:[])}
  if(url.includes('/storage/v1/object/hocco-sponsor-logos/')){if(o.method==='DELETE'){deletes.push(url);return Response.json({})}assert.equal(o.headers['x-upsert'],'false');uploads.push(url);if((mode==='cover-failure'||mode==='uncertain')&&url.includes('-cover.'))return Response.json({error:'failed'},{status:500});return Response.json({})}
  if(url.includes('/hm_sponsors?or=')){const referenced=saved&&(url.includes(encodeURIComponent(saved.logo_url))||url.includes(encodeURIComponent(saved.cover_url)));return Response.json(referenced?[{id:saved.id}]:[])}
  if(url.endsWith('/rpc/hm_create_sponsor_local')){const data=JSON.parse(o.body).p_data;saved={id:'new',code:data.p_code,logo_url:data.p_logo_url,cover_url:data.p_cover_url};if(mode==='race')saved={id:'winner',code:'HC-SP-BBBBBBBBBBBB',logo_url:'https://old/logo',cover_url:'https://old/cover'};if(mode==='lost-response')throw Error('response lost after commit');return Response.json(saved)}
  throw Error('Unexpected isolated call '+url);
 });return{response,body:await response.json(),uploads,deletes,saved};
}
test('retry recovers an existing sponsor without touching images',async()=>{const r=await run('existing',{...payload,logoBase64:'',coverBase64:''});assert.equal(r.response.status,200);assert.equal(r.body.sponsor.id,'old');assert.equal(r.uploads.length,0);assert.equal(r.deletes.length,0)});
test('partial upload failure cleans only the file created by this attempt',async()=>{const r=await run('cover-failure');assert.equal(r.response.status,400);assert.equal(r.deletes.length,1);assert.equal(r.deletes[0],r.uploads[0]);assert.match(r.deletes[0],/-[a-f0-9-]{36}-logo/)});
test('lost RPC response recovers committed sponsor and preserves both files',async()=>{const r=await run('lost-response');assert.equal(r.response.status,200);assert.equal(r.body.sponsor.id,'new');assert.equal(r.deletes.length,0)});
test('competing request returns winner and removes only losing attempt assets',async()=>{const r=await run('race');assert.equal(r.response.status,201);assert.equal(r.body.sponsor.id,'winner');assert.equal(r.deletes.length,2);assert.deepEqual(r.deletes,r.uploads)});
test('unknown database outcome preserves assets rather than deleting blindly',async()=>{const r=await run('uncertain');assert.equal(r.response.status,400);assert.equal(r.deletes.length,0)});
