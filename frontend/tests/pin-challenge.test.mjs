// Changing or resetting the wallet PIN: the route only hands the client a Circle challenge. The PIN
// itself is typed in Circle's widget, so it never passes through Coven.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";

const { db, world, reset } = installFakes();
const route = await load("app/api/circle/pin-challenge/route.ts");

beforeEach(() => {
  reset();
  db.users = [
    { id: "u1", circle_wallet_id: "w1", wallet_address: "0x2222222222222222222222222222222222222222" },
    { id: "u2", circle_wallet_id: null, wallet_address: null },
  ];
});

test("a change starts a PUT /user/pin challenge for the caller's own session token", async () => {
  const r = await callRoute(route, "u1", { kind: "change" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { userToken: "t", encryptionKey: "e", challengeId: "pin-1" });
  const [call] = world.pinChallenges;
  assert.equal(call.method, "PUT");
  assert.equal(call.url, "https://api.circle.com/v1/w3s/user/pin");
  assert.equal(call.userToken, "t");
  assert.match(call.body.idempotencyKey, /^[0-9a-f-]{36}$/);
});

test("a reset starts a POST /user/pin/restore challenge", async () => {
  const r = await callRoute(route, "u1", { kind: "restore" });
  assert.equal(r.status, 200);
  assert.equal(world.pinChallenges[0].method, "POST");
  assert.equal(world.pinChallenges[0].url, "https://api.circle.com/v1/w3s/user/pin/restore");
});

test("refuses an unknown kind and creates no challenge", async () => {
  for (const body of [{ kind: "delete" }, {}, { kind: 1 }]) {
    const r = await callRoute(route, "u1", body);
    assert.equal(r.status, 400);
  }
  assert.equal(world.pinChallenges.length, 0);
});

test("refuses a user with no wallet yet, and an unauthenticated caller", async () => {
  assert.equal((await callRoute(route, "u2", { kind: "change" })).status, 400);
  assert.equal((await callRoute(route, null, { kind: "change" })).status, 401);
  assert.equal(world.pinChallenges.length, 0);
});
