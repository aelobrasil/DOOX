import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8');

test('the customer tracking tab has a renderer and opens private links for video orders', () => {
  assert.match(app, /function renderLookup\(\)/);
  assert.match(app, /if\(parts\[0\]==='acompanhar'&&parts\.length===1\)return renderLookup\(\)/);
  assert.match(app, /tracking-link-form/);
  assert.match(app, /location\.hash=`#\$\{kind\}\/\$\{code\}\/\$\{secret\}`/);
});

test('the customer tracking page includes saved Community and LIVE messages', () => {
  assert.match(app, /const orders=state\.orders\|\|\[\],community=state\.communityOrders\|\|\[\]/);
  assert.match(app, /comunidade-pagamento\/\$\{post\.code\}\/\$\{post\.trackingToken\}/);
  assert.match(app, /communityStatus\(post\)/);
});

test('opening the profile does not create a fake one-day streak', () => {
  const renderBody = app.slice(app.indexOf('async function render(){'), app.indexOf('\nfunction renderCompose'));
  assert.doesNotMatch(renderBody, /registerActiveDay\(\)/);
  assert.match(app, /streak=p\.activeDays\|\|0/);
  assert.match(app, /registerActiveDay\(\);const o=remember/);
  assert.match(app, /registerActiveDay\(\);const entry=\{\.\.\.result\.post/);
});
