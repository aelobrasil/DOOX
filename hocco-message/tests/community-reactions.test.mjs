import test from 'node:test';
import assert from 'node:assert/strict';
import { communityWelcomeLike, communityReactionCount,
  mountCommunityReactions } from '../dist/community-reactions.mjs';

const start = Date.parse('2026-10-30T15:00:00Z');
const post = { id: '123e4567-e89b-12d3-a456-426614174000', published_at: new Date(start).toISOString(),
  expires_at: new Date(start + 4 * 3600_000).toISOString(), likes_count: 0 };

test('starts with the brand reaction only once a message is published', () => {
  assert.equal(communityWelcomeLike(post, start - 1), 0);
  assert.equal(communityWelcomeLike(post, start), 1);
  assert.equal(communityWelcomeLike({ ...post, published_at: null }, start), 0);
  assert.equal(communityWelcomeLike({ ...post, expires_at: 'invalid' }, start), 0);
  assert.equal(communityWelcomeLike({ ...post, expires_at: post.published_at }, start), 0);
});

test('elapsed time, identifiers, reloads and expiry never manufacture additional likes', () => {
  for (let id = 0; id < 300; id++) {
    const sample = { ...post, id: `message-${id}` };
    for (const minutes of [0, 1, 10, 60, 120, 240, 1440]) {
      const time = start + minutes * 60_000;
      assert.equal(communityReactionCount(sample, time), 1);
      assert.equal(communityReactionCount(JSON.parse(JSON.stringify(sample)), time), 1);
    }
  }
});

test('each real vote adds one, removing a vote subtracts one, and real counts have no artificial ceiling', () => {
  assert.equal(communityReactionCount({ ...post, likes_count: 30 }, start), 31);
  assert.equal(communityReactionCount({ ...post, likes_count: 31 }, start), 32);
  assert.equal(communityReactionCount({ ...post, likes_count: 29 }, start), 30);
  assert.equal(communityReactionCount({ ...post, likes_count: 10000 }, start), 10001);
  assert.equal(post.likes_count, 0);
});

test('unusable API counts never create negative or infinite displayed likes', () => {
  for (const value of [-4, NaN, Infinity, 'invalid', undefined]) {
    assert.equal(communityReactionCount({ ...post, likes_count: value }, start), 1);
  }
});

test('refresh pauses in the background and during a vote; disposal clears the timer and listener', () => {
  const saved = { document: globalThis.document, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval };
  const events = new Map(); let tick, cleared, cadence, scans = 0;
  const node = { textContent: '0' }, attributes = { 'aria-pressed': 'false' };
  const element = { dataset: { communityReactions: post.id, reactionPublishedAt: post.published_at,
    reactionExpiresAt: post.expires_at, actualLikes: '0' }, disabled: false,
    querySelector: () => node, matches: () => true, getAttribute: key => attributes[key],
    setAttribute: (key, value) => { attributes[key] = value; } };
  globalThis.document = { hidden: false, addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) };
  globalThis.setInterval = (fn, ms) => { tick = fn; cadence = ms; return 7; };
  globalThis.clearInterval = id => { cleared = id; };
  const root = { isConnected: true, querySelectorAll: () => { scans++; return [element]; } };
  try {
    const mounted = mountCommunityReactions(root, { now: () => start });
    assert.equal(cadence, 30_000); assert.equal(node.textContent, '1'); assert.equal(attributes['aria-label'], 'Gostei. 1 curtida');
    document.hidden = true; tick(); assert.equal(scans, 1);
    document.hidden = false; element.disabled = true; node.textContent = '99'; tick(); assert.equal(node.textContent, '99');
    element.disabled = false; events.get('visibilitychange')(); assert.equal(node.textContent, '1');
    root.isConnected = false; node.textContent = '77'; tick(); assert.equal(node.textContent, '77');
    mounted.dispose(); assert.equal(cleared, 7); assert.equal(events.size, 0);
  } finally { Object.assign(globalThis, saved); }
});
