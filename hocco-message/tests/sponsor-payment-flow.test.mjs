import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [client, edge, policies, admin] = await Promise.all([
  readFile(new URL('../dist/ir-alem/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hocco-message/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../dist/policies.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dist/controle/admin.mjs', import.meta.url), 'utf8'),
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


test('rejected sponsors can be refunded through Mercado Pago after provider payment verification', () => {
  assert.ok(edge.includes("refundApprovedPayment("));
  assert.ok(edge.includes("sponsor_id:row.id,code:row.code,payment_id:String(payment.id)"));
  assert.match(edge, /Devolver pelo Mercado Pago/);
  assert.match(admin, /Devolver pelo Mercado Pago/);
});

test('legacy sponsor refunds require manual confirmation and customers can track outcomes', () => {
  assert.match(edge, /op==='refund_manual'/);
  assert.ok(edge.includes("b.payload?.confirmed!==true"));
  assert.match(admin, /Registrar devolução manual/);
  assert.match(client, /A devolução integral está sendo encaminhada/);
  assert.match(client, /a devolução foi registrada/);
});
