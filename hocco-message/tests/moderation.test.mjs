import test from "node:test";
import assert from "node:assert/strict";
import { moderateCommunityMessage } from "../supabase/functions/hocco-message/moderation.mjs";

test("allows ordinary community messages", () => {
  const result = moderateCommunityMessage("Que bom fazer parte da HOCCO!");
  assert.equal(result.approved, true);
  assert.equal(result.requiresReview, false);
});
test("blocks direct violent threats", () => {
  assert.equal(moderateCommunityMessage("Eu vou matar você").approved, false);
});
test("blocks encouragement of self-harm", () => {
  assert.equal(moderateCommunityMessage("Vai se matar").approved, false);
});
test("blocks calls for violence against a protected group", () => {
  assert.equal(moderateCommunityMessage("Todos os gays devem morrer").approved, false);
});
test("blocks sexual content involving minors", () => {
  assert.equal(moderateCommunityMessage("Quero conteúdo sexual de menor").approved, false);
});
test("blocks links and direct contact data", () => {
  assert.equal(moderateCommunityMessage("Clique em https://example.com").approved, false);
  assert.equal(moderateCommunityMessage("Meu email x@y.com").approved, false);
});
test("normalizes diacritics before checking", () => {
  assert.equal(moderateCommunityMessage("Vai se matár").approved, false);
});
test("blocks threats written with leetspeak substitutions", () => {
  assert.equal(moderateCommunityMessage("Eu vou m4tar todo mundo").category, "safety_policy");
  assert.equal(moderateCommunityMessage("Eu vou m@t@r todo mundo").category, "safety_policy");
});
test("blocks threats split by punctuation or spaces", () => {
  assert.equal(moderateCommunityMessage("E.u v.o.u m.a.t.a.r todo mundo").category, "safety_policy");
  assert.equal(moderateCommunityMessage("e u v o u m a t a r todo mundo").category, "safety_policy");
});
test("blocks threats using Cyrillic homoglyphs", () => {
  assert.equal(moderateCommunityMessage("Eu vоu mаtаr todo mundo").category, "safety_policy");
});
test("blocks elongated threat spellings", () => {
  assert.equal(moderateCommunityMessage("Eu vou mataaaaar todo mundo").category, "safety_policy");
});
test("keeps ordinary double letters intact", () => {
  const result = moderateCommunityMessage("Essa comunidade é incrível");
  assert.equal(result.approved, true);
});
test("sends context-dependent sensitive wording to manual review", () => {
  const result = moderateCommunityMessage("Tenho orgulho da comunidade LGBTQIA");
  assert.equal(result.approved, false);
  assert.equal(result.requiresReview, true);
});

