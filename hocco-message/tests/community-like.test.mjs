import test from "node:test";
import assert from "node:assert/strict";
import { validateCommunityLikeInput } from "../supabase/functions/hocco-message/index.ts";

const valid = {
  messageId: "123e4567-e89b-12d3-a456-426614174000",
  voterToken: "a".repeat(64),
  liked: true,
};

test("accepts a like request with a message id and opaque browser token", () => {
  assert.deepEqual(validateCommunityLikeInput(valid), valid);
});

test("rejects malformed like identity and non-boolean actions", () => {
  assert.throws(() => validateCommunityLikeInput({ ...valid, voterToken: "short" }), /Curtida inválida/);
  assert.throws(() => validateCommunityLikeInput({ ...valid, liked: "true" }), /Curtida inválida/);
  assert.throws(() => validateCommunityLikeInput({ ...valid, messageId: "../other" }), /Curtida inválida/);
});
