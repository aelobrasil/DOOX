import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [client, edge, policies] = await Promise.all([
  readFile(new URL('../dist/ir-alem/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hocco-message/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../dist/policies.mjs', import.meta.url), 'utf8'),
]);

test('sponsor tracking offers checkout before curation, but not after rejection', () => {
  assert.match(client, /pay=s.review!=='rejected'&&s.payment==='pending'/);
  assert.match(edge, /row.payment!=='pending'||row.review==='rejected'/);
  assert.doesNotMatch(edge, /kind==='sponsor'&&row.review!=='approved'/);
});

test('sponsor registration clearly explains payment first and curation before publication', () => {
  assert.match(client, /pagamento é feito antes da curadoria/);
  assert.match(client, /após pagamento e aprovação da curadoria/);
  assert.match(policies, /Curadoria após a solicitação/);
  assert.match(policies, /Pagar não garante aprovação nem publicação/);
});
