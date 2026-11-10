// The statement: every movement of a user's money, filterable by date, totalled, and exportable.
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installFakes, load } from "./helpers/fakes.mjs";

const { db, reset } = installFakes();
const { buildStatement, summarize, toCsv, parseRange } = await load("lib/server/statement.ts");
const history = await load("app/api/history/route.ts");
const exporter = await load("app/api/history/export/route.ts");

const ME = "u1";
const at = (day, h = 10) => `2026-11-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00.000Z`;
const pay = (id, from, to, amount, day, extra = {}) => ({
  id, from_user_id: from, to_user_id: to, amount_usdc: String(amount), fee_usdc: "0", status: "completed",
  circle_id: null, note: null, tx_hash: "0x" + id, created_at: at(day),
  from_user: from ? { username: from === ME ? "me" : "bob" } : null,
  to_user: { username: to === ME ? "me" : "bob" }, ...extra,
});

function input() {
  return {
    userId: ME,
    payments: [
      pay("p1", ME, "u2", 5, 1, { fee_usdc: "0.05", note: "lunch" }),     // sent
      pay("p2", "u2", ME, 20, 2),                                          // received
      pay("p3", null, ME, 50, 3),                                          // faucet deposit
      pay("p4", ME, "u2", 2, 4),                                           // split share
      pay("p5", null, ME, 9, 5, { circle_id: "c1" }),                      // goal payout
      pay("p6", ME, "u2", 7, 6, { circle_id: "c1" }),                      // circle send
      pay("p7", ME, "u2", 100, 7, { status: "failed" }),                   // failed
      pay("p8", ME, "u2", 100, 8, { status: "pending" }),                  // not settled
      pay("x1", "u3", "u4", 999, 2),                                       // someone else's
    ],
    splitPaymentIds: ["p4"],
    contributions: [
      { id: "g1", user_id: ME, amount_usdc: "3", tx_hash: "0xg1", created_at: at(9), goal: { description: "Trip" } },
      { id: "g2", user_id: "u2", amount_usdc: "8", tx_hash: "0xg2", created_at: at(9), goal: { description: "Trip" } },
    ],
    payouts: [
      { id: "o1", user_id: ME, amount_usdc: "10", fee_usdc: "0.1", target_currency: "NGN", deposit_tx_hash: "0xo1", status: "completed", created_at: at(10) },
      { id: "o2", user_id: ME, amount_usdc: "4", fee_usdc: "0.04", target_currency: "NGN", deposit_tx_hash: "0xo2", status: "failed", created_at: at(11) },
    ],
  };
}

test("every kind of money movement is classified, and only the user's own rows appear", () => {
  const rows = buildStatement(input());
  const kind = Object.fromEntries(rows.map((r) => [r.id, r.kind]));
  assert.deepEqual(kind, {
    o2: "cash_out", o1: "cash_out", g1: "goal_contribution", p8: "sent", p7: "sent", p6: "circle_send",
    p5: "goal_payout", p4: "split_pay", p3: "deposit", p2: "received", p1: "sent",
  });
  assert.ok(!rows.some((r) => r.id === "x1" || r.id === "g2"), "other people's rows are never included");
});

test("newest first, with the counterparty, fee and direction filled in", () => {
  const rows = buildStatement(input());
  assert.deepEqual(rows.map((r) => r.at), [...rows.map((r) => r.at)].sort().reverse());
  const sent = rows.find((r) => r.id === "p1");
  assert.deepEqual([sent.direction, sent.counterparty, sent.fee, sent.note], ["out", "bob", 0.05, "lunch"]);
  assert.equal(rows.find((r) => r.id === "p2").counterparty, "bob");
  assert.equal(rows.find((r) => r.id === "g1").counterparty, "Trip");
});

test("a date range keeps only rows inside it, bounds included", () => {
  const rows = buildStatement(input(), { from: at(2, 10), to: at(4, 10) });
  assert.deepEqual(rows.map((r) => r.id).sort(), ["p2", "p3", "p4"]);
  assert.equal(buildStatement(input(), { from: at(20) }).length, 0);
});

test("totals count settled money only: not failed, not pending payments, but a processing cash out", () => {
  const t = summarize(buildStatement(input()));
  // in: 20 received + 50 deposit + 9 payout. out: 5 + 2 + 7 sent/split/circle + 3 goal + 10 cash out.
  assert.deepEqual(t, { moneyIn: 79, moneyOut: 27, fees: 0.15, count: 8 });
  const processing = buildStatement({ ...input(), payments: [], contributions: [], payouts: [{ ...input().payouts[0], status: "processing" }] });
  assert.equal(summarize(processing).moneyOut, 10);
});

test("the CSV has signed amounts, UTC times and a byte-order mark", () => {
  const csv = toCsv(buildStatement(input(), { from: at(1), to: at(2, 23) }));
  const lines = csv.replace("﻿", "").trim().split("\r\n");
  assert.ok(csv.startsWith("﻿"));
  assert.equal(lines[0], "Date (UTC),Type,Direction,Amount (USDC),Fee (USDC),Counterparty,Note,Status,Transaction hash");
  assert.equal(lines[1], "2026-11-02T10:00:00.000Z,Received,In,20,0,bob,,completed,0xp2");
  assert.equal(lines[2], "2026-11-01T10:00:00.000Z,Sent,Out,-5,0.05,bob,lunch,completed,0xp1");
});

test("the CSV cannot carry a spreadsheet formula, and quotes awkward text", () => {
  const evil = input();
  evil.payments = [pay("e1", ME, "u2", 1, 1, { note: '=HYPERLINK("http://evil","click")' }), pay("e2", ME, "u2", 1, 2, { note: "a, \"b\"\nc" }), pay("e3", ME, "u2", 1, 3, { note: "+1 and -2" })];
  evil.contributions = []; evil.payouts = [];
  const csv = toCsv(buildStatement(evil));
  assert.ok(csv.includes(`,"'=HYPERLINK(""http://evil"",""click"")",`), "formula is defused and quoted");
  assert.ok(csv.includes(`,"a, ""b""\nc",`), "commas, quotes and newlines are escaped");
  assert.ok(csv.includes(",'+1 and -2,"), "a leading + is defused");
});

test("date parameters must be real dates and in order", () => {
  assert.deepEqual(parseRange(new URLSearchParams("from=2026-11-01T00:00:00Z")), { range: { from: "2026-11-01T00:00:00.000Z" } });
  assert.match(parseRange(new URLSearchParams("from=nonsense")).error, /not a valid date/);
  assert.match(parseRange(new URLSearchParams("from=2026-11-05&to=2026-11-01")).error, /must not be after/);
  assert.deepEqual(parseRange(new URLSearchParams("")), { range: {} });
});

// ---- the routes
const get = (route, query = "", who = "u1") =>
  route.GET(new Request(`http://t/api/history${query}`, { headers: who ? { authorization: `Bearer tok-${who}` } : {} }));

beforeEach(() => {
  reset();
  db.users = [{ id: "u1", username: "me", circle_wallet_id: null }];
  const i = input();
  db.payments = i.payments;
  db.split_members = [{ payment_id: "p4" }];
  db.goal_contributions = i.contributions;
  db.offramp_payouts = i.payouts;
});

test("the history route needs a signed-in user and valid dates", async () => {
  assert.equal((await get(history, "", null)).status, 401);
  assert.equal((await get(history, "?from=nonsense")).status, 400);
  assert.equal((await get(history, "?direction=sideways")).status, 400);
});

test("the history route pages through everything, newest first, with totals for the whole range", async () => {
  const first = await (await get(history, "?limit=4")).json();
  assert.equal(first.rows.length, 4);
  assert.equal(first.total, 11);
  assert.equal(first.nextOffset, 4);
  assert.equal(first.totals.moneyIn, 79);
  const second = await (await get(history, "?limit=4&offset=4")).json();
  const third = await (await get(history, "?limit=4&offset=8")).json();
  assert.equal(third.nextOffset, null);
  const ids = [...first.rows, ...second.rows, ...third.rows].map((r) => r.id);
  assert.equal(new Set(ids).size, 11, "no row repeats or is skipped across pages");
});

test("the history route filters by direction and by date", async () => {
  const inbound = await (await get(history, "?direction=in")).json();
  assert.deepEqual(inbound.rows.map((r) => r.id).sort(), ["p2", "p3", "p5"]);
  const day = await (await get(history, `?from=${at(2, 0)}&to=${at(2, 23)}`)).json();
  assert.deepEqual(day.rows.map((r) => r.id), ["p2"]);
});

test("the export is a CSV download of the chosen range", async () => {
  const res = await exporter.GET(new Request(`http://t/api/history/export?from=${at(1, 0)}&to=${at(2, 23)}`, { headers: { authorization: "Bearer tok-u1" } }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(res.headers.get("content-disposition"), /attachment; filename="coven-statement-me-2026-11-01_to_2026-11-02\.csv"/);
  const body = await res.text();
  assert.equal(body.trim().split("\r\n").length, 3);
  assert.equal((await exporter.GET(new Request("http://t/api/history/export"))).status, 401);
});
