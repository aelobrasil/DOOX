import test from "node:test";
import assert from "node:assert/strict";
import { validateCommunityPricing } from "../supabase/functions/hocco-message/pricing.mjs";
import { readFile } from "node:fs/promises";

const admin = await readFile(new URL("../dist/controle/admin.mjs", import.meta.url), "utf8");
const customer = await readFile(new URL("../dist/app.mjs", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/hocco-message/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20261024150923_community_live_pricing_controls.sql", import.meta.url), "utf8");

test("admin pricing accepts valid Community and LIVE values in cents", () => {
  assert.deepEqual(validateCommunityPricing({ communityPriceCents: 350, livePriceCents: 550 }), {
    communityPriceCents: 350,
    livePriceCents: 550,
  });
});

test("admin pricing rejects missing, fractional, or out-of-range values", () => {
  for (const payload of [
    { communityPriceCents: 0, livePriceCents: 550 },
    { communityPriceCents: 350, livePriceCents: 1000000 },
    { communityPriceCents: 350.5, livePriceCents: 550 },
    { communityPriceCents: 350 },
  ]) assert.throws(() => validateCommunityPricing(payload));
});

test("control exposes both editable prices and a protected settings action", () => {
  assert.match(admin, /community-pricing-form/);
  assert.match(admin, /admin\.community\.pricing/);
  assert.match(edge, /if\(action==='admin\.community\.pricing'\)/);
  assert.match(edge, /hm_team_members\?user_id=/);
});

test("customer display and database price snapshots use the configured values", () => {
  assert.match(customer, /communityPrice=catalog.settings.community_price_cents/);
  assert.match(customer, /livePrice=catalog.settings.live_price_cents/);
  assert.match(edge, /community_price_cents,live_price_cents/);
  assert.match(migration, /live_price_cents/);
  assert.match(migration, /community_price_cents/);
  assert.match(migration, /set constraint|price_cents between 1 and 999900/);
});
