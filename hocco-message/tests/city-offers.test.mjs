import test from 'node:test';
import assert from 'node:assert/strict';
import {cityOffers} from '../dist/city-offers.mjs';
const now=Date.parse('2026-10-28T12:00:00Z');
const rows=[
 {id:'local',city:'São Paulo',state_code:'SP',category:'Serviços',community_offer:'10% de desconto',offer_expires_on:'2026-10-28'},
 {id:'other-state',city:'São Paulo',state_code:'PR',category:'Serviços',community_offer:'Outra oferta'},
 {id:'other-city',city:'Bauru',state_code:'SP',category:'Serviços',community_offer:'Outra cidade'},
 {id:'no-offer',city:'São Paulo',state_code:'SP',category:'Serviços',company_description:'Empresa sem benefício',community_offer:''},
 {id:'expired',city:'São Paulo',state_code:'SP',category:'Serviços',community_offer:'Oferta antiga',offer_expires_on:'2026-10-27'},
 {id:'no-deadline',city:'São Paulo',state_code:'SP',category:'Alimentação',community_offer:'Benefício vigente'}
];
test('home offers require both city and state, never fall back to all cities',()=>{
 for(const choice of [{},{city:'São Paulo'},{uf:'SP'},{city:'',uf:'SP'}])assert.deepEqual(cityOffers(rows,choice,now),[]);
});
test('home offers match normalized city and exact state, excluding missing and expired benefits',()=>{
 assert.deepEqual(cityOffers(rows,{city:'  SAO   PAULO ',uf:'SP'},now).map(x=>x.id),['local','no-deadline']);
});
test('category filtering does not broaden the selected city',()=>{
 assert.deepEqual(cityOffers(rows,{city:'São Paulo',uf:'SP',category:'Serviços'},now).map(x=>x.id),['local']);
 assert.deepEqual(cityOffers(rows,{city:'Outra cidade',uf:'SP'},now),[]);
});
test('offer is valid through its last day in Brasilia, then disappears',()=>{
 assert.ok(cityOffers(rows,{city:'São Paulo',uf:'SP'},Date.parse('2026-10-29T02:59:59Z')).some(x=>x.id==='local'));
 assert.ok(!cityOffers(rows,{city:'São Paulo',uf:'SP'},Date.parse('2026-10-29T03:00:00Z')).some(x=>x.id==='local'));
});
