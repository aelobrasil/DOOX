import test from 'node:test';
import assert from 'node:assert/strict';
import {publicOffers,publicBenefit} from '../dist/city-offers.mjs';
import {readFileSync} from 'node:fs';

const t=Date.parse('2026-11-03T15:00:00Z');
const offers=[
 {id:'sp',city:'São Paulo',state_code:'SP',category:'Serviços',community_offer:'10% OFF'},
 {id:'rj',city:'Rio de Janeiro',state_code:'RJ',category:'Alimentação',community_offer:'5% OFF'},
 {id:'no-city',city:null,state_code:null,category:'Serviços',community_offer:'Benefício nacional'},
 {id:'empty-offer',city:'São Paulo',state_code:'SP',community_offer:''},
 {id:'expired',city:'São Paulo',state_code:'SP',community_offer:'Antigo',offer_expires_on:'2026-11-02'}
];
test('home lists all current sponsors without requiring location',()=>{
 assert.deepEqual(publicOffers(offers,{},t).map(s=>s.id),['sp','rj','no-city','empty-offer','expired']);
});
test('user can filter by city, UF, category separately or in combination',()=>{
 assert.deepEqual(publicOffers(offers,{uf:'SP'},t).map(s=>s.id),['sp','empty-offer','expired']);
 assert.deepEqual(publicOffers(offers,{city:'RIO DE JANEIRO'},t).map(s=>s.id),['rj']);
 assert.deepEqual(publicOffers(offers,{category:'Serviços'},t).map(s=>s.id),['sp','no-city']);
 assert.deepEqual(publicOffers(offers,{city:'São Paulo',uf:'RJ'},t),[]);
});
test('expired benefit does not conceal an otherwise active sponsor',()=>{
 assert.deepEqual(publicOffers(offers,{city:'São Paulo'},t).map(s=>s.id),['sp','empty-offer','expired']);
 assert.equal(publicBenefit(offers[4],t),'');
 assert.equal(publicBenefit(offers[3],t),'');
 assert.equal(publicBenefit(offers[0],t),'10% OFF');
});
test('city-only discovery on home and directory retains registration UF and core controls',()=>{
 const directory=readFileSync(new URL('../dist/ir-alem/app.mjs',import.meta.url),'utf8');
 assert.match(directory,/Sua cidade está na HOCCO/);
 assert.match(directory,/data-hocco-city/);
 assert.doesNotMatch(directory,/id="directory-uf"/);
 assert.match(directory,/id="sponsor-state"/);
 const src=readFileSync(new URL('../dist/cinema.mjs',import.meta.url),'utf8');
 assert.match(src,/Sua cidade está na HOCCO/);
 assert.doesNotMatch(src,/id="cinema-uf"/);
 assert.match(src,/data-cinema-city/);
});
test('hero mounts national-safe selector and retains core participation controls',()=>{
 const src=readFileSync(new URL('../dist/cinema.mjs',import.meta.url),'utf8');
 assert.match(src,/publicOffers\(rows,\{city,category\}\)/);
 assert.match(src,/publicBenefit\(s\)/);
 assert.match(src,/id="cinema-participate"/);
 assert.match(src,/id="community-send"/);
 assert.match(src,/id="cinema-sponsor-content"/);
 assert.match(src,/id="cinema-sound"/);
 assert.match(src,/href="#enviar"/);
});

test('city name alone returns matching companies across UFs without hiding homonyms',()=>{
 const companies=[{id:'same-sp',city:'Santa Helena',state_code:'SP',community_offer:''},{id:'same-pr',city:'Santa Helena',state_code:'PR',community_offer:''},{id:'other',city:'Ibitinga',state_code:'SP',community_offer:''}];
 assert.deepEqual(publicOffers(companies,{city:'SANTA HELENA'}).map(x=>x.id),['same-sp','same-pr']);
});
test('no audience threshold appears in sponsor onboarding UI',()=>{
 const directory=readFileSync(new URL('../dist/ir-alem/app.mjs',import.meta.url),'utf8');
 assert.match(directory,/Cadastros abertos para empresas de todo o Brasil/);
 assert.doesNotMatch(directory,/100 acessos|100 visitantes|100 visualiza[cç]/i);
});
