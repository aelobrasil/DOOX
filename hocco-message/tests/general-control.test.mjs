import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const admin = await readFile(new URL('../dist/controle/admin.mjs', import.meta.url), 'utf8');
const customer = await readFile(new URL('../dist/app.mjs', import.meta.url), 'utf8');
const edge = await readFile(new URL('../supabase/functions/hocco-message/index.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20261024155600_general_control_center.sql', import.meta.url), 'utf8');

test('general control panel exposes per-area pauses, Community duration, and founder notice', () => {
  assert.match(admin, /function renderGeneral\(\)/);
  assert.match(admin, /name="videoEnabled"/);
  assert.match(admin, /name="communityEnabled"/);
  assert.match(admin, /name="liveEnabled"/);
  assert.match(admin, /name="sponsorsEnabled"/);
  assert.match(admin, /name="communityDurationHours"/);
  assert.match(admin, /name="founderNotice"/);
  assert.match(admin, /name="videoPrice1"/);
  assert.match(admin, /name="videoPrice2"/);
  assert.match(admin, /name="communityPrice"/);
  assert.match(admin, /name="livePrice"/);
  assert.match(admin, /name="sponsorPrice"/);
  assert.match(admin, /admin\.general\.update/);
});

test('general settings update is team-authorized, bounded, and audited transactionally', () => {
  assert.match(edge, /action==='admin\.general\.update'/);
  assert.match(migration, /hm_team_members where user_id=p_actor and active/);
  assert.match(migration, /community_duration_hours between 1 and 24/);
  assert.match(migration, /char_length\(founder_notice\) <= 500/);
  assert.match(migration, /insert into public\.hm_audit\(actor_id,action,detail\)/);
  assert.match(migration, /hm_sponsor_settings/);
  assert.match(migration, /community_price_cents=community_price/);
  assert.match(migration, /price_cents=sponsor_price/);
});

test('public message creation is blocked server-side when a destination is paused', () => {
  assert.match(edge, /v\.destination==='community'&&controls\.community_enabled===false/);
  assert.match(edge, /v\.destination==='live'&&controls\.live_enabled===false/);
  assert.match(edge, /cfg\.video_enabled===false/);
  assert.match(edge, /s\.video_enabled!==false/);
  assert.match(edge, /hidden_at=is\.null/);
});

test('editing and hiding messages preserve history and require a new review', () => {
  assert.match(admin, /dataset\.action='edit'/);
  assert.match(admin, /dataset\.action='archive'/);
  assert.match(admin, /dataset.communityAction='hide'/);
  assert.match(migration, /hm_admin_edit_video_message/);
  assert.match(migration, /hm_admin_edit_community_message/);
  assert.match(migration, /hm_admin_hide_community_message/);
  assert.match(migration, /review='pending'/);
  assert.match(migration, /previous_message/);
  assert.match(migration, /hm_admin_restore_community_message/);
});

test('public client escapes founder notice and reflects current Community duration', () => {
  assert.match(customer, /notice\.textContent=settings\.founder_notice_active\?String\(settings\.founder_notice\|\|''\)/);
  assert.match(customer, /community_duration_hours/);
  assert.match(migration, /make_interval\(hours=>coalesce\(duration_hours,4\)\)/);
});
