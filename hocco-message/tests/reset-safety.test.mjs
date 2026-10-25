import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const edge=await readFile(new URL('../supabase/functions/hocco-message/index.ts',import.meta.url),'utf8');
test('legacy reset cannot delete orders or financial audit records',async()=>{
 const start=edge.indexOf("if(action==='customer.reset')"),end=edge.indexOf("if(action.startsWith('admin.'))",start);
 assert.ok(start>=0&&end>start);
 let writes=0;
 const response=await vm.runInNewContext('(async()=>{'+edge.slice(start,end)+'})()',{
 action:'customer.reset',b:{orders:[{code:'HM-26-ABCDEF123456',trackingToken:'a'.repeat(64)}]},
 db:async()=>{writes++;throw Error('Unexpected database operation')},reply:(body,status)=>({body,status})
 });
 assert.equal(response.status,409);assert.equal(writes,0);
});
