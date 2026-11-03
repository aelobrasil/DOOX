import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {mergeSavedPurchases} from '../dist/customer-sync.mjs';import {communityProgress,progressMarkup} from '../dist/tracking-progress.mjs';
const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
test('profile refresh updates database status without replacing the form being edited',async()=>{
 const code='HC-CM-AABBCCDDEEFF',status={classList:{toggle(){}},textContent:''},copy={},label={},form={value:'Unsaved name'};
 const card={dataset:{savedCode:code},querySelector:s=>s.includes('.badge')?status:copy};
 const app={querySelectorAll:()=>[card],querySelector:s=>s==='#saved-sync-status'?label:s==='#profile-name'?form:null};let timer;
 const context=vm.createContext({renderVersion:1,savedSyncTimer:null,document:{hidden:false},app,state:{orders:[],communityOrders:[{code,trackingToken:'a'.repeat(64),payment:'pending'}]},mergeSavedPurchases,save(){},communityStatus:r=>r.payment,messageStatus:r=>r.payment,clearInterval(){},setInterval:f=>(timer=f,1),api:async()=>({entries:[{kind:'community',code,record:{code,payment:'confirmed',message:'Updated'}}]})});
 vm.runInContext(source.slice(source.indexOf('function startSavedSync()'),source.indexOf('function registerActiveDay()')),context);vm.runInContext('startSavedSync()',context);await new Promise(setImmediate);
 assert.equal(status.textContent,'confirmed');assert.equal(copy.textContent,'Updated');assert.equal(form.value,'Unsaved name');assert.equal(typeof timer,'function');assert.equal(context.state.communityOrders[0].trackingToken,'a'.repeat(64));
});
test('published community tracking keeps polling and shows a later moderation removal',async()=>{
 let current={code:'HC-CM-AABBCCDDEEFF',member_name:'Tester',member_username:'tester',payment:'confirmed',review:'approved',published_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),message:'Test',price_cents:1,updated_at:'initial'},callback;
 const app={innerHTML:'',querySelector:()=>null};const context=vm.createContext({communityStatusTimer:null,communityReactions:null,renderVersion:1,app,location:{hash:'#comunidade-pagamento/test'},document:{hidden:false},api:async()=>({post:{...current}}),rememberCommunity:r=>r,esc:s=>String(s||''),avatarArt:()=>'',money:()=>'',communityProgress,progressMarkup,paymentFeedback:()=>'',communityReactionData:()=>'',communityBrandReaction:'',communityReactionCount:()=>0,mountCommunityReactions:()=>({dispose(){}}),notifyCommunityReactionUpdates(){},decorateParticipation(){},$:()=>null,clearInterval(){},setInterval:(fn,ms)=>{callback=fn;assert.equal(ms,10000);return 1}});
 const start=source.indexOf('function communityStatus('),end=source.indexOf('function renderExpiredComment(',start);vm.runInContext(source.slice(start,end),context);
 await vm.runInContext("renderCommunityPayment('HC-CM-AABBCCDDEEFF','"+'a'.repeat(64)+"',1)",context);assert.equal(typeof callback,'function');
 current={...current,hidden_at:new Date().toISOString(),updated_at:'hidden'};await callback();assert.ok(app.innerHTML.includes('Mensagem retirada da exibição'));
});
