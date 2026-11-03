import test from 'node:test';import assert from 'node:assert/strict';
import {decorateParticipation} from '../dist/participation-layout.mjs';
test('simulation is visible immediately with muted video and playback controls, and can be collapsed',()=>{
 const saved={document:globalThis.document,location:globalThis.location};let wrapper,plays=0,pauses=0;
 const video={play(){plays++;return Promise.resolve()},pause(){pauses++}},simulation={closest(){return null},before(el){wrapper=el},querySelector(){return video}};
 const root={querySelector:s=>s==='.simulation-area'?simulation:null,insertAdjacentHTML(){}};
 globalThis.document={body:{classList:{contains:()=>true}},createElement:tag=>({tag,append(...children){this.children=children},addEventListener(event,fn){this[event]=fn}})};globalThis.location={hash:'#enviar'};
 try{decorateParticipation(root);assert.equal(wrapper.open,true);assert.equal(wrapper.children[1],simulation);assert.equal(video.controls,true);assert.equal(video.muted,true);assert.equal(plays,1);wrapper.open=false;wrapper.toggle();assert.equal(pauses,1);wrapper.open=true;wrapper.toggle();assert.equal(plays,2)}finally{Object.assign(globalThis,saved)}
});
