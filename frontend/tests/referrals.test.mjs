// An invite is recorded once, only for a new account, and never for yourself or an unknown handle.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";

const { db, reset } = installFakes();
const claim = await load("app/api/referrals/claim/route.ts");
const { cleanRef, referralLink } = await load("lib/referral.ts");

const hoursAgo = (h) => new Date(Date.now() - h * 3600_000).toISOString();

beforeEach(() => {
  reset();
  db.users = [
    { id: "alice", username: "alice", created_at: hoursAgo(1000) },
    { id: "bob", username: "bob", created_at: hoursAgo(1), referred_by: null },
    { id: "carol", username: "carol", created_at: hoursAgo(48), referred_by: null },
    { id: "dave", username: "dave", created_at: hoursAgo(1), referred_by: "alice" },
  ];
});
const referredBy = (id) => db.users.find((u) => u.id === id).referred_by;

test("a new user is attributed to the inviter", async () => {
  const r = await callRoute(claim, "bob", { ref: "alice" });
  assert.equal(r.status, 200);
  assert.equal(r.body.attributed, true);
  assert.equal(referredBy("bob"), "alice");
});

test("an invite link's @ and case are tolerated", async () => {
  assert.equal((await callRoute(claim, "bob", { ref: "@Alice" })).body.attributed, true);
});

test("you cannot invite yourself", async () => {
  assert.equal((await callRoute(claim, "bob", { ref: "bob" })).body.attributed, false);
  assert.equal(referredBy("bob"), null);
});

test("an unknown or malformed handle is not attributed", async () => {
  assert.equal((await callRoute(claim, "bob", { ref: "nobody" })).body.attributed, false);
  assert.equal((await callRoute(claim, "bob", { ref: "x" })).body.attributed, false);
  assert.equal((await callRoute(claim, "bob", {})).body.attributed, false);
  assert.equal(referredBy("bob"), null);
});

test("the inviter cannot be changed once set", async () => {
  const r = await callRoute(claim, "dave", { ref: "bob" });
  assert.equal(r.body.attributed, false);
  assert.equal(referredBy("dave"), "alice");
});

test("an older account cannot be attributed after the fact", async () => {
  const r = await callRoute(claim, "carol", { ref: "alice" });
  assert.equal(r.body.attributed, false);
  assert.equal(referredBy("carol"), null);
});

test("signed-out requests are refused", async () => {
  const res = await claim.POST(new Request("http://test.local", { method: "POST", body: "{}" }));
  assert.equal(res.status, 401);
});

test("invite links carry the username and reject junk", () => {
  assert.equal(referralLink("https://coven.app", "alice"), "https://coven.app/r/alice");
  assert.equal(cleanRef("@Alice"), "alice");
  assert.equal(cleanRef("a b"), null);
  assert.equal(cleanRef(null), null);
});
