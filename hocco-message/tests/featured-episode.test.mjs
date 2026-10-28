import test from 'node:test';
import assert from 'node:assert/strict';
import {handler} from '../supabase/functions/hocco-message/index.ts';
import {featuredEpisodeMarkup,cinemaHomeMarkup} from '../dist/cinema.mjs';
const actor='11111111-1111-4111-8111-111111111111';
const env={get:k=>({SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-test-only'}[k])};
async function request(action,payload,{authorized=true,member=true,episode={featured_episode_title:'Parte 1',featured_episode_url:'https://www.youtube.com/watch?v=abcdefghijk',featured_episode_updated_at:'2026-10-27T00:00:00Z'}}={}){
 const writes=[];
 const fetcher=async(url,options={})=>{
  const u=new URL(url);
  assert.equal(u.hostname,'database.invalid');
  if(u.pathname==='/auth/v1/user')return Response.json({id:actor,email_confirmed_at:'2026-01-01'});
  if(u.pathname==='/rest/v1/hm_team_members')return Response.json(member?[{user_id:actor}]:[]);
  if(u.pathname==='/rest/v1/hm_settings')return Response.json([episode]);
  if(u.pathname==='/rest/v1/rpc/hm_set_featured_episode'){const data=JSON.parse(options.body);writes.push(data);return Response.json({title:data.p_title,url:data.p_url})}
  throw Error('Unexpected test request '+u.pathname);
 };
 const response=await handler(new Request('https://app.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer isolated-test'}:{})},body:JSON.stringify({action,payload})}),env,fetcher);
 return {status:response.status,body:await response.json(),writes};
}
test('episode public read returns only public fields',async()=>{const r=await request('series.episode',{}, {episode:{featured_episode_title:'Parte 1',featured_episode_url:'https://www.youtube.com/watch?v=abcdefghijk',featured_episode_updated_at:null,pix_key:'must-not-leak'}});assert.equal(r.status,200);assert.deepEqual(r.body,{episode:{title:'Parte 1',url:'https://www.youtube.com/watch?v=abcdefghijk',updatedAt:null}})});
test('unconfigured episode remains empty without invented content',async()=>{const r=await request('series.episode',{}, {episode:{}});assert.equal(r.body.episode,null)});
test('team can publish canonical YouTube title and link without price writes',async()=>{const r=await request('admin.episode.update',{title:' Parte 1 ',url:'https://youtu.be/abcdefghijk?si=tracking'});assert.equal(r.status,200);assert.deepEqual(r.writes,[{p_actor:actor,p_title:'Parte 1',p_url:'https://www.youtube.com/watch?v=abcdefghijk'}])});
test('clear episode only accepts both empty fields',async()=>{const r=await request('admin.episode.update',{title:'',url:''});assert.equal(r.status,200);assert.equal(r.writes[0].p_url,'')});
for(const payload of [{title:'Episode',url:''},{title:'',url:'https://youtu.be/abcdefghijk'},{title:'A'.repeat(121),url:'https://youtu.be/abcdefghijk'},{title:'Episode',url:'https://evil.invalid/watch?v=abcdefghijk'},{title:'Episode',url:'javascript:alert(1)'}])test('invalid episode rejected: '+JSON.stringify(payload).slice(0,75),async()=>{const r=await request('admin.episode.update',payload);assert.equal(r.status,400);assert.equal(r.writes.length,0)});
for(const opts of [{authorized:false},{member:false}])test('episode writes require administrator identity '+JSON.stringify(opts),async()=>{const r=await request('admin.episode.update',{title:'Part',url:'https://youtu.be/abcdefghijk'},opts);assert.ok([401,403].includes(r.status));assert.equal(r.writes.length,0)});
test('episode presentation escapes title and ignores untrusted destinations',()=>{const html=featuredEpisodeMarkup({title:'<script>alert(1)</script>',url:'https://www.youtube.com/watch?v=abcdefghijk'});assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!featuredEpisodeMarkup({title:'x',url:'https://evil.invalid'}).includes('evil.invalid'))});
test('carousel includes accessible age indication',()=>{assert.ok(cinemaHomeMarkup().includes('aria-label="Classificação indicativa: 12 anos"'))});
