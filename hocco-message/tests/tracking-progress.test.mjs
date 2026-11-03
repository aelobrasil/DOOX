import test from 'node:test';import assert from 'node:assert/strict';
import {privateTrackingHash,normalizeTrackingHash,communityProgress} from '../dist/tracking-progress.mjs';
const key='a'.repeat(64),code='HC-CM-AABBCCDDEEFF';
test('payment return strips provider metadata after a complete private token',()=>{for(const suffix of ['?collection_id=123&status=approved','&payment_id=123',''])assert.equal(normalizeTrackingHash(`#comunidade-pagamento/${code}/${key}${suffix}`),`#comunidade-pagamento/${code}/${key}`)});
test('missing key recovers only the same saved purchase and rejects malformed secrets',()=>{const saved=[{code,trackingToken:key}];assert.equal(normalizeTrackingHash(`#comunidade-pagamento/${code}`,saved),`#comunidade-pagamento/${code}/${key}`);for(const hash of [`#comunidade-pagamento/HC-CM-000000000000`,`#comunidade-pagamento/${code}/bad`,`#comunidade-pagamento/${code}/${'a'.repeat(63)}?status=approved`])assert.equal(normalizeTrackingHash(hash,saved),hash)});
test('timeline requires confirmed payment and actual publication, never a return query',()=>{const pending={review:'approved',payment:'pending'};assert.equal(communityProgress(pending).terminal,false);assert.equal(communityProgress({...pending,published_at:'2026-11-02'}).steps[3].done,false);assert.equal(communityProgress({...pending,payment:'confirmed'}).steps[3].done,false);assert.equal(communityProgress({...pending,payment:'confirmed',published_at:'2026-11-02'}).steps[3].done,true)});
test('rejected, held and refunded requests never report a successful publication',()=>{for(const changes of [{review:'rejected'},{payment_hold:true},{payment:'refunded'},{hidden_at:'2026-11-02'}]){const p=communityProgress({review:'approved',payment:'confirmed',published_at:'2026-11-02',...changes});assert.equal(p.terminal,true);assert.equal(p.steps[3].done,false)}});
test('return metadata can contain a URL without becoming part of the private secret',()=>{assert.equal(normalizeTrackingHash(`#comunidade-pagamento/${code}/${key}?source=https://example.com/return`),`#comunidade-pagamento/${code}/${key}`)});
test('expired publication is described as ended and financial review takes priority',()=>{const post={review:'approved',payment:'confirmed',published_at:'2026-01-01T00:00:00Z',expires_at:'2026-01-02T00:00:00Z'};assert.match(communityProgress(post,Date.parse('2026-02-01')).notice,/terminou/);assert.match(communityProgress({...post,payment_hold:true},Date.parse('2026-02-01')).notice,/revisão/);assert.match(communityProgress({...post,content_removed_at:'2026-02-01'}).notice,/excluído/)});
test('LIVE keeps checking until the reading, even when its community display already ended',()=>{const post={destination:'live',review:'approved',payment:'confirmed',published_at:'2026-01-01',expires_at:'2026-01-02',live_status:'queued'};const queued=communityProgress(post,Date.parse('2026-02-01'));assert.equal(queued.terminal,false);assert.equal(queued.steps.at(-1).done,false);assert.match(queued.notice,/Aguardando/);const read=communityProgress({...post,live_status:'read'});assert.equal(read.terminal,true);assert.equal(read.steps.at(-1).done,true)});

test('profile links select the correct status endpoint for community, live and video',()=>{
 for(const destination of ['community','live'])assert.equal(privateTrackingHash({code,trackingToken:key,destination}),`comunidade-pagamento/${code}/${key}`);
 const video={code:'HM-26-AABBCCDDEEFF',trackingToken:key};
 assert.equal(privateTrackingHash(video),`acompanhar/${video.code}/${key}`);
 assert.equal(privateTrackingHash(video,'pagamento'),`pagamento/${video.code}/${key}`);
});
test('legacy profile links recover community tracking without changing or weakening the private token',()=>{
 for(const route of ['acompanhar','pagamento','pedido']){
  assert.equal(normalizeTrackingHash(`#${route}/${code}/${key}`),`#comunidade-pagamento/${code}/${key}`);
  assert.equal(normalizeTrackingHash(`#${route}/${code}`,[{code,trackingToken:key}]),`#comunidade-pagamento/${code}/${key}`);
  assert.equal(normalizeTrackingHash(`#${route}/${code}/bad`,[{code,trackingToken:key}]),`#${route}/${code}/bad`);
 }
});
