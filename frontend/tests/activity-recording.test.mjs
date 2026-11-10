// A failed activity save must not lose the other rows, must retry what is worth retrying, and must be
// loud about what it could not save. The action it describes (a payment, a request) already happened.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakes, load } from "./helpers/fakes.mjs";

const { db, world, reset } = installFakes();
const { recordActivity } = await load("lib/server/activity.ts");
const realFetch = globalThis.fetch;

let posts;
const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Make activity inserts fail: `refuse(row)` -> an error to return for that row, or null to let it save. */
function failActivity(refuse) {
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname === "/rest/v1/activity" && (init.method ?? "GET").toUpperCase() === "POST") {
      posts++;
      const body = JSON.parse(init.body);
      for (const row of Array.isArray(body) ? body : [body]) {
        const err = refuse(row);
        if (err) return json(err.body, err.status);
      }
    }
    return realFetch(input, init);
  };
}
const constraint = (row) =>
  row.type === "request_sent" ? { status: 400, body: { code: "23514", message: "violates check constraint activity_type_check" } } : null;

const asked = { user_id: "bob", type: "request_received", reference_id: "r1", actor_id: "me", amount_usdc: 5 };
const mine = { user_id: "me", type: "request_sent", reference_id: "r1", actor_id: "bob", amount_usdc: 5, read: true };

beforeEach(() => {
  reset();
  posts = 0;
  globalThis.fetch = realFetch;
});

test("when every row is accepted it is one insert", async () => {
  failActivity(() => null);
  assert.equal(await recordActivity([asked, mine]), true);
  assert.equal(posts, 1);
  assert.equal(db.activity.length, 2);
});

test("a row the database refuses does not take the others down with it", async () => {
  failActivity(constraint);
  assert.equal(await recordActivity([asked, mine]), false);
  assert.deepEqual(db.activity.map((a) => a.type), ["request_received"], "the valid row still saved");
});

test("what could not be saved is logged under [activity-failed] with enough to find it", async () => {
  failActivity(constraint);
  await recordActivity([asked, mine]);
  const line = world.errors.find((e) => e.startsWith("[activity-failed]"));
  assert.ok(line, "a searchable error line");
  const [failed] = JSON.parse(line.replace("[activity-failed] ", ""));
  assert.deepEqual(
    { type: failed.type, user: failed.user_id, ref: failed.reference_id, code: failed.code },
    { type: "request_sent", user: "me", ref: "r1", code: "23514" }
  );
});

test("a refusal by a constraint is not retried, a transient error is, once", async () => {
  failActivity(constraint);
  await recordActivity([mine]);
  assert.equal(posts, 2, "the batch, then the row once: no retry for a constraint");

  posts = 0;
  let flaky = 0;
  failActivity((row) => (row.type === "request_received" && ++flaky <= 2 ? { status: 503, body: { message: "upstream down" } } : null));
  assert.equal(await recordActivity([asked]), true);
  assert.equal(posts, 3, "batch fails, row fails, retry succeeds");
  assert.equal(db.activity.length, 1);
});

test("an empty list is a no-op, and it never throws", async () => {
  failActivity(() => ({ status: 500, body: { message: "down" } }));
  assert.equal(await recordActivity([]), true);
  assert.equal(await recordActivity([asked]), false);
});
