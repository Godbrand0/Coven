// Making a payment request leaves a record for both people: the one asked, and the one who asked.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { callRoute, installFakes, load } from "./helpers/fakes.mjs";
import { toNotification } from "../lib/server/notifications.ts";

const { db, reset } = installFakes();
const route = await load("app/api/payments/request/route.ts");

beforeEach(() => {
  reset();
  db.users = [
    { id: "me", username: "me" },
    { id: "bob", username: "bob" },
  ];
});

test("the requester gets their own activity entry, already read, naming who they asked", async () => {
  const r = await callRoute(route, "me", { toUsername: "@Bob", amountUsdc: 5, note: "lunch" });
  assert.equal(r.status, 200);

  const mine = db.activity.find((a) => a.user_id === "me");
  assert.deepEqual(
    { type: mine.type, actor: mine.actor_id, amount: mine.amount_usdc, note: mine.note, read: mine.read },
    { type: "request_sent", actor: "bob", amount: 5, note: "lunch", read: true }
  );
  assert.equal(mine.reference_id, r.body.request.id);
});

test("the person asked still gets request_received, unread", async () => {
  await callRoute(route, "me", { toUsername: "bob", amountUsdc: 5 });
  const theirs = db.activity.find((a) => a.user_id === "bob");
  assert.equal(theirs.type, "request_received");
  assert.equal(theirs.actor_id, "me");
  assert.notEqual(theirs.read, true);
  assert.equal(db.activity.length, 2);
});

test("a refused request (yourself, unknown user, bad amount) records nothing", async () => {
  assert.equal((await callRoute(route, "me", { toUsername: "me", amountUsdc: 5 })).status, 400);
  assert.equal((await callRoute(route, "me", { toUsername: "ghost", amountUsdc: 5 })).status, 404);
  assert.equal((await callRoute(route, "me", { toUsername: "bob", amountUsdc: 0 })).status, 400);
  assert.equal((db.activity ?? []).length, 0);
});

test("the notification reads 'You requested $5.00 from @bob'", () => {
  const n = toNotification({ type: "request_sent", amount_usdc: 5, note: "lunch", actor: { username: "bob" } });
  assert.equal(n.title, "Request sent");
  assert.equal(n.body, "You requested $5.00 from @bob - “lunch”");
});
