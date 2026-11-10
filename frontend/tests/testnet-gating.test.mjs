// The tracker is testnet-only, and /api/health shows its detail only to the operator.
// Own file = own process, so NEXT_PUBLIC_NETWORK can be set before lib/network.ts is first read.
process.env.NEXT_PUBLIC_NETWORK = "mainnet";
process.env.HEALTH_TOKEN = "s3cret-token";

import assert from "node:assert/strict";
import { test } from "node:test";
import { installFakes, load } from "./helpers/fakes.mjs";

installFakes();
globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });

const tracker = await load("app/api/testnet/route.ts");
const health = await load("app/api/health/route.ts");

test("the tracker API does not exist on mainnet", async () => {
  const res = await tracker.GET();
  assert.equal(res.status, 404);
});

test("health shows only ok to anonymous callers, and still answers 503 when a check fails", async () => {
  const res = await health.GET(new Request("http://x/api/health"));
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false });
});

test("health refuses a wrong token and an unset one, and shows detail for the right one", async () => {
  const wrong = await health.GET(new Request("http://x/api/health", { headers: { authorization: "Bearer nope" } }));
  assert.deepEqual(await wrong.json(), { ok: false });

  const right = await health.GET(new Request("http://x/api/health", { headers: { authorization: "Bearer s3cret-token" } }));
  const body = await right.json();
  assert.equal(body.network, "mainnet");
  assert.ok(Array.isArray(body.checks) && body.checks.length > 0);

  delete process.env.HEALTH_TOKEN;
  const unset = await health.GET(new Request("http://x/api/health", { headers: { authorization: "Bearer " } }));
  assert.deepEqual(await unset.json(), { ok: false });
});
