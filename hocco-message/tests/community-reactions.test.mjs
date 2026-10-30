import test from 'node:test';
import assert from 'node:assert/strict';
import { automatedCommunityLikes, communityReactionCount, communityReactionProfile,
  mountCommunityReactions, COMMUNITY_REACTION_LIMIT } from '../dist/community-reactions.mjs';

const start = Date.parse('2026-10-30T15:00:00Z');
const post = { id: '123e4567-e89b-12d3-a456-426614174000', published_at: new Date(start).toISOString(),
  expires_at: new Date(start + 4 * 3600_000).toISOString(), likes_count: 0 };

test('starts with the brand reaction only once a message is published', () => {
  assert.equal(automatedCommunityLikes(post, start - 1), 0);
  assert.equal(automatedCommunityLikes(post, start), 1);
  assert.equal(automatedCommunityLikes({ ...post, published_at: null }, start), 0);
  assert.equal(automatedCommunityLikes({ ...post, expires_at: 'invalid' }, start), 0);
  assert.equal(automatedCommunityLikes({ ...post, expires_at: post.published_at }, start), 0);
});

test('growth is deterministic across devices/reloads, monotone, bounded and frozen after expiry', () => {
  for (let id = 0; id < 300; id++) {
    const sample = { ...post, id: `message-${id}` };
    let previous = 1;
    for (let minute = 0; minute <= 240; minute++) {
      const time = start + minute * 60_000, count = automatedCommunityLikes(sample, time);
      assert.equal(count, automatedCommunityLikes(JSON.parse(JSON.stringify(sample)), time));
      assert.ok(count >= previous && count <= COMMUNITY_REACTION_LIMIT);
      previous = count;
    }
    assert.equal(automatedCommunityLikes(sample, start + 86400_000), previous);
  }
});

test('targets vary widely and high numbers are rare; many messages expire below their target', () => {
  const profiles = Array.from({ length: 10000 }, (_, id) => communityReactionProfile(`message-${id}`));
  assert.ok(new Set(profiles.map(p => p.target)).size > 600);
  assert.ok(profiles.filter(p => p.target < 50).length > 5000);
  assert.ok(profiles.filter(p => p.target >= 700).length < 200);
  assert.ok(profiles.every(p => p.target >= 3 && p.target <= 890));
  assert.ok(profiles.some(p => p.target === 890));
  const unfinished = profiles.filter(p => p.duration > 4 * 3600_000).length;
  assert.ok(unfinished > 3000);
});

test('real like/unlike changes only the actual component and the display never exceeds 890', () => {
  const time = start + 3600_000, initial = communityReactionCount(post, time);
  assert.equal(communityReactionCount({ ...post, likes_count: 1 }, time), initial + 1);
  assert.equal(communityReactionCount({ ...post, likes_count: 10000 }, time), 890);
  assert.equal(communityReactionCount({ ...post, likes_count: -4 }, time), initial);
  assert.equal(post.likes_count, 0);
});

test('refresh pauses in the background and during a vote; disposal clears the timer and listener', () => {
  const saved = { document: globalThis.document, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  const events = new Map(); let tick, cleared, scans = 0;
  const node = { textContent: '0' }, attributes = { 'aria-pressed': 'false' };
  const element = { dataset: { communityReactions: post.id, reactionPublishedAt: post.published_at,
    reactionExpiresAt: post.expires_at, actualLikes: '0' }, disabled: false,
    querySelector: () => node, matches: () => true, getAttribute: key => attributes[key],
    setAttribute: (key, value) => { attributes[key] = value; } };
  globalThis.document = { hidden: false, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) };
  globalThis.setInterval = fn => { tick = fn; return 7; };
  globalThis.clearInterval = id => { cleared = id; };
  const root = { isConnected: true, querySelectorAll: () => { scans++; return [element]; } };
  try {
    const mounted = mountCommunityReactions(root, { now: () => start });
    assert.equal(node.textContent, '1'); assert.equal(attributes['aria-label'], 'Gostei. 1 curtidas');
    document.hidden = true; tick(); assert.equal(scans, 1);
    document.hidden = false; element.disabled = true; node.textContent = '99'; tick(); assert.equal(node.textContent, '99');
    element.disabled = false; events.get('visibilitychange')(); assert.equal(node.textContent, '1');
    root.isConnected = false; node.textContent = '77'; tick(); assert.equal(node.textContent, '77');
    mounted.dispose(); assert.equal(cleared, 7); assert.equal(events.size, 0);
  } finally { Object.assign(globalThis, saved); }
});
