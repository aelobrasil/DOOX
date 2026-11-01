import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMarkup} from '../dist/experience.mjs';
import {experienceMarkup} from '../dist/controle/overview.mjs';
import {handler} from '../supabase/functions/hocco-message/index.ts';
import {cinemaSlides,cinemaGallery,watchMarkup} from '../dist/cinema.mjs';
test('registration review escapes customer fields and exposes editing before sending',()=>{const html=reviewMarkup([['Empresa','<img src=x onerror=alert(1)>'],['Link','https://example.com/?a="test"']]);assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/data-edit-registration/);assert.match(html,/data-confirm-registration/)});
test('gallery preserves every illustration while the main carousel stays focused',()=>{assert.equal(cinemaSlides.length,5);assert.equal(cinemaGallery.length,10);const html=watchMarkup('galeria');for(const s of cinemaGallery)assert.ok(html.includes(s.image));assert.equal((html.match(/aria-current="page"/g)||[]).length,1)});
test('dashboard aggregates action counts and ignores unknown event names',()=>{const html=experienceMarkup([{event_name:'company_review',total:3},{event_name:'company_review',total:4},{event_name:'<script>',total:99}]);assert.match(html,/>7<\/strong>/);assert.doesNotMatch(html,/<script>|99/)});
test('arbitrary analytics payloads cannot write customer content',async()=>{let calls=0;const r=await handler(new Request('https://app.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'analytics.event',event:'private-token-or-message'})}),{get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test'}[k])},async()=>{calls++;throw Error('No database write')});assert.equal(r.status,400);assert.equal(calls,0)});
test('anonymous action counters respect the existing measurement opt out',async()=>{
 const {trackExperience}=await import('../dist/config.mjs');const keys=['window','location','localStorage','fetch'],saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),calls=[];
 try{globalThis.window={};globalThis.location={pathname:'/'};globalThis.localStorage={getItem:()=> 'off'};globalThis.fetch=async(...args)=>{calls.push(args);return {}};trackExperience('channel_open');assert.equal(calls.length,0);globalThis.localStorage={getItem:()=>null};trackExperience('channel_open');assert.deepEqual(JSON.parse(calls[0][1].body),{action:'analytics.event',event:'channel_open'})}finally{for(const k of keys)if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k]}
});
