import test from 'node:test';
import assert from 'node:assert/strict';
import {readJsonBody} from '../supabase/functions/hocco-message/request-body.mjs';
import {handler} from '../supabase/functions/hocco-message/index.ts';
test('streamed JSON accepts split UTF8 characters within byte budget',async()=>{
 const bytes=new TextEncoder().encode('{"message":"ação"}');let i=0;const body=new ReadableStream({pull(c){if(i===bytes.length)c.close();else c.enqueue(bytes.slice(i,i+=1))}});assert.deepEqual(await readJsonBody(new Request('https://app.invalid',{method:'POST',body,duplex:'half'}),bytes.length),{message:'ação'});
});
test('declared oversized body is rejected before consuming it',async()=>{const r=new Request('https://app.invalid',{method:'POST',headers:{'content-length':'100'},body:'{}'});await assert.rejects(()=>readJsonBody(r,20),e=>e.status===413)});
test('chunked oversized body is cancelled even without declared length',async()=>{let cancelled=false;const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(32))},cancel(){cancelled=true}});await assert.rejects(()=>readJsonBody(new Request('https://app.invalid',{method:'POST',body,duplex:'half'}),20),e=>e.status===413);assert.equal(cancelled,true)});
test('oversized API request performs no database or payment operation',async()=>{let calls=0;const r=await handler(new Request('https://app.invalid',{method:'POST',headers:{'content-length':'4000000'},body:'{}'}),{get:k=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'isolated-service'}[k])},async()=>{calls++;throw Error('No external access')});assert.equal(r.status,413);assert.equal(calls,0)});
