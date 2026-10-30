import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { communityActualLikes, communityReactionCount, paintCommunityReactions } from '../dist/community-reactions.mjs';

const app = await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const communityBrandReaction='), app.indexOf('async function loadLiveQueue'));
const start = Date.parse('2026-10-30T18:00:00Z');
const post = { id: '123e4567-e89b-12d3-a456-426614174000', message: 'Minha mensagem',
  member_name: 'Cliente', member_username: 'cliente', avatar_index: 1,
  published_at: new Date(start).toISOString(), expires_at: new Date(start + 4 * 3600_000).toISOString(), likes_count: 0 };

function harness() {
  let time = start, buttons = [], markup = '', calls = [], error = false, actual = 0, deferred;
  const state = { communityLikes: [] }, notices = [];
  const track = { dataset: {}, isConnected: true,
    set innerHTML(value) {
      markup = value;
      buttons = [...value.matchAll(/<button class="community-like [\s\S]*?<\/button>/g)].map(([html]) => {
        const attrs = Object.fromEntries([...html.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
        const dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, val]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), val]));
        const node = { textContent: html.match(/community-like-count">(\d+)/)[1] };
        return { dataset, attrs, node, disabled: false, classList: { toggle() {} },
          matches: selector => selector === 'button', setAttribute: (key, val) => { attrs[key] = val; }, getAttribute: key => attrs[key],
          querySelector: () => node, addEventListener(type, fn) { this[type] = fn; } };
      });
    },
    get innerHTML() { return markup; },
    querySelector() { return buttons[0]; }, querySelectorAll(selector) { return selector === '[data-community-like]' ? buttons : []; },
  };
  const api = async (action, body) => {
    calls.push({ action, body });
    if (action === 'community.feed') return { messages: [{ ...post, likes_count: actual }] };
    if (error) throw Error('Falha de teste');
    if (deferred) await deferred;
    actual = body.liked ? actual + 1 : Math.max(0, actual - 1);
    return { liked: body.liked, likesCount: actual };
  };
  const context = vm.createContext({ state, api, $: () => track, CSS: { escape: x => x }, esc: x => String(x),
    communityActualLikes, communityReactionCount: p => communityReactionCount(p, time),
    paintCommunityReactions: el => paintCommunityReactions(el, time),
    mountCommunityReactions: () => ({ refresh() {} }), mountCommunityCarousel: () => ({ refresh() {} }),
    avatarArt: () => '', relativeCommunityTime: () => 'agora', communityVoterToken: () => 'a'.repeat(64),
    save() {}, toast: text => notices.push(text), communityCarousel: null, communityReactions: null });
  const { loadCommunityFeed } = vm.runInContext(source + '\n({loadCommunityFeed})', context);
  return { track, state, calls, notices, load: loadCommunityFeed, button: () => buttons[0],
    setTime(value) { time = value; }, fail(value) { error = value; }, setActual(value) { actual = value; },
    defer(promise) { deferred = promise; } };
}

test('feed render and unchanged-feed refresh never grow without votes; real likes and failures reconcile', async () => {
  const h = harness(); await h.load(); const button = h.button();
  assert.match(h.track.innerHTML, /A HOCCO curtiu sua mensagem/);
  assert.equal(button.node.textContent, '1');
  h.setTime(start + 2 * 3600_000); await h.load();
  assert.equal(h.button(), button, 'refresh must preserve the existing carousel and button');
  const displayed = Number(button.node.textContent); assert.equal(displayed, 1);
  await button.click(); assert.equal(Number(button.node.textContent), displayed + 1);
  assert.equal(button.attrs['aria-pressed'], 'true'); assert.deepEqual(h.state.communityLikes, [post.id]);
  await h.load(); assert.equal(Number(button.node.textContent), displayed + 1);
  await button.click(); assert.equal(Number(button.node.textContent), displayed);
  h.fail(true); await button.click();
  assert.equal(Number(button.node.textContent), displayed); assert.equal(button.attrs['aria-pressed'], 'false');
  assert.equal(h.state.communityLikes.length, 0); assert.equal(button.disabled, false); assert.equal(h.notices[0], 'Falha de teste');
  const votes = h.calls.filter(call => call.action === 'community.like');
  assert.equal(votes.length, 3);
  assert.deepEqual(Object.keys(votes[0].body).sort(), ['liked', 'messageId', 'voterToken']);
});

test('feed refresh cannot overwrite a pending optimistic like and the API response wins', async () => {
  const h = harness(); await h.load(); const button = h.button();
  let release; h.defer(new Promise(resolve => { release = resolve; }));
  const pending = button.click(); assert.equal(button.disabled, true); assert.equal(button.node.textContent, '2');
  await h.load(); assert.equal(button.node.textContent, '2');
  h.setActual(9); release(); await pending;
  assert.equal(button.dataset.actualLikes, '10'); assert.equal(button.node.textContent, '11');
  assert.equal(button.disabled, false); assert.match(button.attrs['aria-label'], /11 curtidas/);
});

test('only newly observed real likes on the client own messages produce an in-app notice', async () => {
  const h = harness(); h.state.communityOrders = [{ id: post.id }]; h.setActual(20);
  await h.load(); assert.equal(h.notices.length, 0, 'old likes establish a baseline silently');
  h.setActual(21); await h.load();
  assert.equal(h.notices[0], 'Sua mensagem recebeu uma nova curtida.');
  await h.load(); h.setTime(start + 3 * 3600_000); await h.load();
  assert.equal(h.notices.length, 1, 'time and repeat refreshes must not create notices');
  h.setActual(24); await h.load();
  assert.equal(h.notices[1], 'Suas mensagens receberam 3 novas curtidas.');
  h.setActual(22); await h.load(); assert.equal(h.notices.length, 2, 'unlikes are silent');
  const other = harness(); await other.load(); other.setActual(30); await other.load();
  assert.equal(other.notices.length, 0, 'other clients messages never trigger a personal notice');
});
