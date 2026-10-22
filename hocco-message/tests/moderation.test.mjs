import test from "node:test";
import assert from "node:assert/strict";
import { moderateCommunityMessage } from "../supabase/functions/hocco-message/moderation.mjs";

test("allows ordinary community messages", () => {
  assert.equal(moderateCommunityMessage("Que bom fazer parte da HOCCO!").approved, true);
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
