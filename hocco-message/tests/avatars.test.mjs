import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarCount,avatarIndex,avatarStyle,applyAvatar} from '../dist/avatars.mjs';

test('ten selectable portraits have distinct isolated source frames',()=>{
 assert.equal(avatarCount,10);
 assert.equal(new Set(Array.from({length:avatarCount},(_,i)=>avatarStyle(i))).size,10);
});
test('legacy profiles and published messages share the same valid fallback',()=>{
 for(let i=10;i<20;i++){
  assert.equal(avatarIndex(i),i-10);
  const header={style:{}};applyAvatar(header,i);
  assert.equal(header.style.cssText,avatarStyle(i-10));
 }
 for(const value of [undefined,NaN,Infinity,-1])assert.equal(avatarIndex(value),0);
});
test('profile header keeps the portrait viewport as its positioning container',async()=>{
 const {readFile}=await import('node:fs/promises');
 const css=await readFile(new URL('../dist/cinema.css',import.meta.url),'utf8');
 assert.match(css,/\.cinema-app header \.avatar>\.avatar-portrait\{position:relative\}/);
});
