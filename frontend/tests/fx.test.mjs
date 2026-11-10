// The "≈ local" estimate uses a live market rate, falls back across two sources, and never returns a
// made-up number silently: it says when the figure is not a fresh live rate.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { load } from "./helpers/fakes.mjs";

const { getMarketRate, resetMarketRates } = await load("lib/server/fx.ts");

const A = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const B = "https://open.er-api.com/v6/latest/USD";
const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body });

let calls;
function stub(handlers) {
  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const h = handlers[String(url)];
    if (!h) throw new Error("unstubbed " + url);
    return h();
  };
}
beforeEach(() => resetMarketRates());

test("uses the first source and reads the rate for a currency", async () => {
  stub({ [A]: () => jsonRes({ date: "2026-11-10", usd: { ngn: 1345.4, ghs: 11.67 } }) });
  const r = await getMarketRate("ngn");
  assert.deepEqual(r, { rate: 1345.4, source: "currency-api", asOf: "2026-11-10", stale: false });
});

test("falls back to the second source when the first is down", async () => {
  stub({
    [A]: () => jsonRes({}, false),
    [B]: () => jsonRes({ result: "success", time_last_update_utc: "Tue, 10 Nov 2026", rates: { NGN: 1349, GHS: 11.7 } }),
  });
  const r = await getMarketRate("GHS");
  assert.equal(r.source, "open.er-api");
  assert.equal(r.rate, 11.7);
  assert.equal(r.stale, false);
});

test("rejects a garbage table (no usable NGN) and moves on", async () => {
  stub({
    [A]: () => jsonRes({ date: "x", usd: { ngn: 0 } }),
    [B]: () => jsonRes({ result: "success", rates: { NGN: 1349 } }),
  });
  assert.equal((await getMarketRate("NGN")).source, "open.er-api");
});

test("keeps one table for an hour instead of refetching per request", async () => {
  stub({ [A]: () => jsonRes({ usd: { ngn: 1345, kes: 129.9 } }) });
  await getMarketRate("NGN");
  await getMarketRate("KES");
  assert.equal(calls.length, 1);
});

test("with every source down it uses the fixed table and says so", async () => {
  stub({ [A]: () => jsonRes({}, false), [B]: () => jsonRes({}, false) });
  const r = await getMarketRate("NGN");
  assert.equal(r.source, "fallback");
  assert.equal(r.stale, true);
  assert.ok(r.rate > 1000 && r.rate < 1700);
});

test("USD is exactly 1, and an unknown currency is an error, not a silent 1", async () => {
  stub({ [A]: () => jsonRes({ usd: { ngn: 1345 } }) });
  assert.equal((await getMarketRate("USD")).rate, 1);
  await assert.rejects(getMarketRate("XYZ"), /No exchange rate/);
});
