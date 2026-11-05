import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{normalizeCnpj,validCnpj,simplifyRegistry} from '../api/cnpj.js';
import {lookupCnpj} from '../dist/cnpj-verification.mjs';

const makeRes=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
test('CNPJ numeric valid and repeated zeros invalid',()=>{
 assert.equal(validCnpj('19.131.243/0001-97'),true);
 assert.equal(validCnpj('00.000.000/0000-00'),false);
 assert.equal(validCnpj('19.131.243/0001-98'),false);
 assert.equal(normalizeCnpj(' 19.131.243/0001-97 '),'19131243000197');
});
test('rejects invalid CNPJ without outbound network access',async()=>{
 const res=makeRes();
 await handler({method:'GET',query:{cnpj:'00000000000000'},headers:{}},res);
 assert.equal(res.statusCode,400);
});
test('fetches only approved BrasilAPI endpoint and returns minimal fields',async()=>{
 const real=globalThis.fetch;
 let url='';
 globalThis.fetch=async requested=>{url=String(requested);return {ok:true,status:200,json:async()=>({cnpj:'19131243000197',razao_social:'EMPRESA MODELO',nome_fantasia:'Modelo',descricao_situacao_cadastral:'ATIVA',municipio:'Bauru',uf:'SP',qsa:[{nome_socio:'DADO QUE NAO DEVE SAIR'}]})}};
 try{
 const res=makeRes();await handler({method:'GET',query:{cnpj:'19.131.243/0001-97'},headers:{}},res);
 assert.equal(res.statusCode,200);assert.equal(url,'https://brasilapi.com.br/api/cnpj/v1/19131243000197');
 assert.equal(res.body.registry.legalName,'EMPRESA MODELO');assert.equal(res.body.registry.active,true);
 assert.equal(JSON.stringify(res.body).includes('DADO QUE NAO DEVE SAIR'),false);
 }finally{globalThis.fetch=real}
});
test('returns unavailability without falsely confirming nonexistent company',async()=>{
 const real=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline')};
 try{const res=makeRes();await handler({method:'GET',query:{cnpj:'19131243000197'},headers:{}},res);assert.equal(res.statusCode,503);assert.equal('registry' in res.body,false)}finally{globalThis.fetch=real}
});
test('browser helper treats unavailable lookup as pending manual review',async()=>{
 const x=await lookupCnpj('19.131.243/0001-97',async()=>({ok:false,status:503,json:async()=>({error:'Indisponível'})}));
 assert.equal(x.kind,'unavailable');
});
test('status other than ATIVA cannot be presented as active',()=>{
 assert.equal(simplifyRegistry({cnpj:'19131243000197',descricao_situacao_cadastral:'BAIXADA'}).active,false);
});
