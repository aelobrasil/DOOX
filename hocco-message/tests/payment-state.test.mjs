import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentState} from '../dist/payment-state.mjs';
import {paymentFeedback} from '../dist/config.mjs';
const now=Date.parse('2026-10-25T12:00:00Z');
const active={payment:'confirmed',review:'approved',published_at:'2026-10-25T11:00:00Z',expires_at:'2026-10-25T15:00:00Z'};
for(const [label,order,kind,state] of [
 ['unpaid cannot appear published',{...active,payment:'pending'},'community','pending'],
 ['paid awaiting publication',{payment:'confirmed',review:'approved'},'community','processing'],
 ['published',active,'community','published'],
 ['expired',{...active,expires_at:'2026-10-25T11:30:00Z'},'community','expired'],
 ['hidden',{...active,hidden_at:'2026-10-25T11:30:00Z'},'community','hidden'],
 ['refunded',{...active,payment:'refunded'},'community','refunded'],
 ['rejected',{...active,review:'rejected'},'community','rejected'],
 ['sponsor review',{payment:'confirmed',review:'pending'},'sponsor','review'],
 ['live not queued',{payment:'confirmed',review:'approved'},'live','processing'],
 ['live queued',{payment:'confirmed',review:'approved',live_status:'queued'},'live','queued'],
 ['video in production',{payment:'confirmed',review:'approved',delivery:'pending'},'video','queued'],
 ['future publication',{...active,published_at:'2026-10-26T11:00:00Z'},'community','processing']
])test(label,()=>assert.equal(paymentState(order,kind,now).state,state));
test('feedback announces status with vector confirmation',()=>{const html=paymentFeedback({payment:'confirmed',review:'approved'},'community');assert.match(html,/role="status"/);assert.match(html,/<svg/);assert.match(html,/Publicação em processamento/);assert.doesNotMatch(html,/está na Comunidade/)});
