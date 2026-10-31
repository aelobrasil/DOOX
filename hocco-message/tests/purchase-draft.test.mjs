import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurchaseDraft,clearPurchaseDraft} from '../dist/purchase-draft.mjs';

test('lost responses and module reloads reuse a token without persisting personal content',async()=>{
 const previous=globalThis.sessionStorage,storage=new Map();
 globalThis.sessionStorage={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 try{
  const payload={message:'Mensagem privada de teste',name:'Participante',image:'base64-test'},first=await preparePurchaseDraft('community',payload);
  const reloaded=await import('../dist/purchase-draft.mjs?reload-test');
  assert.equal(await reloaded.preparePurchaseDraft('community',{image:'base64-test',name:'Participante',message:payload.message}),first);
  const value=storage.get('hocco-purchase-draft-community');assert.doesNotMatch(value,/Mensagem privada|Participante|base64-test/);
  assert.notEqual(await preparePurchaseDraft('community',{...payload,message:'Outro pedido'}),first);
  const current=await preparePurchaseDraft('community',payload);clearPurchaseDraft('community',current);
  assert.notEqual(await preparePurchaseDraft('community',payload),current);
 }finally{globalThis.sessionStorage=previous}
});
test('blocked browser storage still supports an idempotent retry in the current tab',async()=>{
 const previous=globalThis.sessionStorage;
 globalThis.sessionStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 try{const payload={message:'Retry'},one=await preparePurchaseDraft('sponsor',payload);assert.equal(await preparePurchaseDraft('sponsor',payload),one);clearPurchaseDraft('sponsor',one);assert.notEqual(await preparePurchaseDraft('sponsor',payload),one)}finally{globalThis.sessionStorage=previous}
});
