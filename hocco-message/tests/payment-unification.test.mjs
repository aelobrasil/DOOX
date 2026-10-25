import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentCard } from '../dist/config.mjs';

const [home, sponsor, admin, edge] = await Promise.all([
  readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dist/ir-alem/app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../dist/controle/admin.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hocco-message/index.ts', import.meta.url), 'utf8'),
]);

test('video, Community, LIVE, and sponsor checkout share one escaped payment card with distinct visual themes', () => {
  for (const kind of ['video', 'community', 'live', 'sponsor']) {
    const html = paymentCard({ kind, title: '<script>', product: 'Item', detail: 'Prazo', amount: 350, buttonId: 'checkout' });
    assert.match(html, new RegExp(`data-payment-kind="${kind}"`));
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /Pagar com Pix ou cartão/);
    assert.match(html, /R\$\s?3,50/);
  }
  assert.match(home, /paymentCard\(\{kind:'video'/);
  assert.match(home, /kind:isLive\?'live':'community'/);
  assert.match(sponsor, /paymentCard\(\{kind:'sponsor'/);
});

test('team controls cannot confirm a pending payment manually', () => {
  assert.doesNotMatch(admin, /data-action="pay"/);
  assert.doesNotMatch(admin, /data-community-action="pay"/);
  assert.doesNotMatch(admin, /data-sponsor-action="pay"/);
  assert.doesNotMatch(edge, /\['approve','reject','pay'/);
  assert.match(edge, /O pagamento só pode ser confirmado automaticamente pelo Mercado Pago/);
});

test('sponsor curation waits for verified payment and rejection requests a provider refund when available', () => {
  assert.match(edge, /A curadoria só pode começar após a confirmação do pagamento pelo Mercado Pago/);
  assert.match(edge, /externalReference:paymentReference\('sponsor',s\.code\)/);
  assert.match(edge, /updates\.payment='refunded'/);
  assert.match(admin, /Aguardando pagamento confirmado/);
});
