import test from "node:test";
import assert from "node:assert/strict";
import { validateCommunityInput } from "../supabase/functions/hocco-message/index.ts";

const base = {
  name: "Ana",
  username: "ana.hocco",
  avatar: 4,
  message: "Que bom fazer parte da HOCCO!",
  trackingToken: "a".repeat(64),
};

test("community defaults to the existing 3h Community destination", () => {
  assert.equal(validateCommunityInput(base).destination, "community");
});

test("live messages accept the explicit live destination", () => {
  assert.equal(validateCommunityInput({ ...base, destination: "live" }).destination, "live");
});

test("destination is allowlisted server-side", () => {
  assert.throws(
    () => validateCommunityInput({ ...base, destination: "https://example.com" }),
    /Escolha Comunidade ou LIVE/,
  );
});
