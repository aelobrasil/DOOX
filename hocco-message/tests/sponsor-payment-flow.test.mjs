import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [client, edge, policies, home] = await Promise.all([
  readFile(new URL('../dist/ir-alem/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hocco-message/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../dist/policies.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8'),
]);
const admin = await readFile(new URL('../dist/controle/admin.mjs', import.meta.url), 'utf8');

test('sponsor tracking offers checkout before curation, but not after rejection', () => {
  assert.match(client, /pay=!s.payment_hold&&s.review!=='rejected'&&s.payment==='pending'/);
  assert.match(edge, /row.payment!=='pending'||row.review==='rejected'/);
  assert.doesNotMatch(edge, /kind==='sponsor'&&row.review!=='approved'/);
});

test('sponsor registration clearly explains payment first and curation before publication', () => {
  assert.match(client, /pagamento é feito antes da curadoria/);
  assert.match(client, /após pagamento e aprovação da curadoria/);
  assert.match(client, /Curadoria após a confirmação do pagamento/);
  assert.doesNotMatch(client, /Cadastro revisado pela equipe/);
  assert.match(policies, /Curadoria após a solicitação/);
  assert.match(policies, /Pagar não garante aprovação nem publicação/);
});

test('approved sponsor payment can be refunded through Mercado Pago with a recorded payment id', () => {
  assert.match(edge, /refundApprovedPayment\(/);
  assert.match(edge, /s\.mercado_pago_payment_id/);
  assert.match(edge, /Devolver pelo Mercado Pago/);
  assert.match(admin, /Devolver pelo Mercado Pago/);
});

test('legacy sponsor refunds require explicit manual confirmation and customer can track the result', () => {
  assert.match(edge, /op==='refund_manual'/);
  assert.match(edge, /b\.payload\?\.confirmed!==true/);
  assert.match(admin, /Registrar devolução manual/);
  assert.match(client, /A devolução integral está sendo encaminhada/);
  assert.match(client, /a devolução foi registrada/);
});

test('community and video message refunds verify provider payment before recording a refund', () => {
  assert.match(edge, /paymentReference\('community',current\.code\)/);
  assert.match(edge, /paymentReference\('order',current\.code\)/);
  assert.match(edge, /mercado_pago_payment_id/);
  assert.match(edge, /hm_audit\?order_id=eq\./);
  assert.match(admin, /Devolver pelo Mercado Pago/);
});

test('customer-facing copy agrees that Community messages stay up for four hours', () => {
  assert.match(home, /communityDuration/);
  assert.match(policies, /preços e a duração de exibição da Comunidade e da LIVE/);
  assert.match(admin, /community_duration_hours/);
});
