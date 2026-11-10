/**
 * A user's statement: every movement of their money, from the tables that hold the truth (payments,
 * goal contributions, cash outs), as one list that can be filtered by date, paged through, totalled
 * and exported. The activity feed is for notifications; this is for "what happened to my money".
 *
 * buildStatement / summarize / toCsv are pure so they can be tested without a database.
 */
import { getSupabaseAdmin } from "@/lib/supabase";

import { STATEMENT_KINDS, type StatementKind, type StatementRow, type Totals } from "@/lib/statement-types";

export { STATEMENT_KINDS, type StatementKind, type StatementRow, type Totals };

type UserRef = { username: string } | null | undefined;
type Num = number | string | null | undefined;

export interface StatementInput {
  userId: string;
  payments: {
    id: string;
    from_user_id: string | null;
    to_user_id: string;
    amount_usdc: Num;
    fee_usdc?: Num;
    note?: string | null;
    tx_hash?: string | null;
    status?: string | null;
    circle_id?: string | null;
    created_at: string;
    from_user?: UserRef;
    to_user?: UserRef;
  }[];
  /** Payment ids that were this user's share of a bill split. */
  splitPaymentIds: string[];
  contributions: {
    id: string;
    user_id: string;
    amount_usdc: Num;
    tx_hash?: string | null;
    created_at: string;
    goal?: { description: string } | null;
  }[];
  payouts: {
    id: string;
    user_id: string;
    amount_usdc: Num;
    fee_usdc?: Num;
    target_currency?: string | null;
    deposit_tx_hash?: string | null;
    status?: string | null;
    created_at: string;
  }[];
}

/** Inclusive bounds, as ISO timestamps. */
export interface Range {
  from?: string;
  to?: string;
}

const num = (v: Num) => Number(v ?? 0) || 0;

function inRange(at: string, { from, to }: Range): boolean {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  if (from && t < Date.parse(from)) return false;
  if (to && t > Date.parse(to)) return false;
  return true;
}

/** One list from the three tables, newest first. Rows that are not this user's, or outside the range, are dropped. */
export function buildStatement(input: StatementInput, range: Range = {}): StatementRow[] {
  const { userId } = input;
  const splitIds = new Set(input.splitPaymentIds);
  const rows: StatementRow[] = [];

  for (const p of input.payments) {
    const outgoing = p.from_user_id === userId;
    const incoming = p.to_user_id === userId;
    if (!outgoing && !incoming) continue;

    let kind: StatementKind;
    let counterparty: string | null;
    if (outgoing) {
      kind = splitIds.has(p.id) ? "split_pay" : p.circle_id ? "circle_send" : "sent";
      counterparty = p.to_user?.username ?? null;
    } else if (p.from_user_id === null) {
      // No Coven sender: a goal paying out to its recipient, or a deposit from outside (faucet, other wallet).
      kind = p.circle_id ? "goal_payout" : "deposit";
      counterparty = null;
    } else {
      kind = "received";
      counterparty = p.from_user?.username ?? null;
    }

    rows.push({
      id: p.id,
      at: p.created_at,
      kind,
      direction: STATEMENT_KINDS[kind].direction,
      amount: num(p.amount_usdc),
      fee: outgoing ? num(p.fee_usdc) : 0,
      counterparty,
      note: p.note ?? null,
      txHash: p.tx_hash ?? null,
      status: p.status ?? "completed",
    });
  }

  for (const c of input.contributions) {
    if (c.user_id !== userId) continue;
    rows.push({
      id: c.id,
      at: c.created_at,
      kind: "goal_contribution",
      direction: "out",
      amount: num(c.amount_usdc),
      fee: 0,
      counterparty: c.goal?.description ?? null,
      note: null,
      txHash: c.tx_hash ?? null,
      status: "completed", // only recorded after the contribution is verified on-chain
    });
  }

  for (const o of input.payouts) {
    if (o.user_id !== userId) continue;
    rows.push({
      id: o.id,
      at: o.created_at,
      kind: "cash_out",
      direction: "out",
      amount: num(o.amount_usdc),
      fee: num(o.fee_usdc),
      counterparty: null,
      note: o.target_currency ? `To bank (${o.target_currency})` : "To bank",
      txHash: o.deposit_tx_hash ?? null,
      status: o.status ?? "pending",
    });
  }

  return rows
    .filter((r) => inRange(r.at, range))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? 1 : -1));
}

/** A failed payment or cash out did not move money, so it is not counted. */
export function counts(row: StatementRow): boolean {
  return row.status !== "failed" && !(row.kind !== "cash_out" && row.status === "pending");
}


export function summarize(rows: StatementRow[]): Totals {
  let moneyIn = 0;
  let moneyOut = 0;
  let fees = 0;
  let count = 0;
  for (const r of rows) {
    if (!counts(r)) continue;
    count++;
    if (r.direction === "in") moneyIn += r.amount;
    else {
      moneyOut += r.amount;
      fees += r.fee;
    }
  }
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { moneyIn: round(moneyIn), moneyOut: round(moneyOut), fees: round(fees), count };
}

/** A text cell that a spreadsheet must not read as a formula (notes and usernames come from users). */
function textCell(value: string | null): string {
  if (!value) return "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const money = (n: number) => n.toFixed(6).replace(/\.?0+$/, "") || "0";

/** The statement as CSV: one row per movement, amounts signed (+ in, − out), times in UTC. */
export function toCsv(rows: StatementRow[]): string {
  const header = ["Date (UTC)", "Type", "Direction", "Amount (USDC)", "Fee (USDC)", "Counterparty", "Note", "Status", "Transaction hash"];
  const lines = rows.map((r) =>
    [
      new Date(r.at).toISOString(),
      STATEMENT_KINDS[r.kind].label,
      r.direction === "in" ? "In" : "Out",
      (r.direction === "in" ? "" : "-") + money(r.amount),
      r.fee ? money(r.fee) : "0",
      textCell(r.counterparty),
      textCell(r.note),
      r.status,
      r.txHash ?? "",
    ].join(",")
  );
  // A byte-order mark, so Excel reads accented names as UTF-8.
  return "﻿" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}

const PAGE_CAP = 5000;

/** Read the user's rows from the database for the range. `truncated` is true when a table hit the cap. */
export async function loadStatement(
  userId: string,
  range: Range = {},
  cap = PAGE_CAP
): Promise<{ rows: StatementRow[]; truncated: boolean }> {
  const admin = getSupabaseAdmin();
  const bound = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T): T => {
    if (range.from) q = q.gte("created_at", range.from);
    if (range.to) q = q.lte("created_at", range.to);
    return q;
  };

  const [payments, splits, contributions, payouts] = await Promise.all([
    bound(
      admin
        .from("payments")
        .select(
          "id, from_user_id, to_user_id, amount_usdc, fee_usdc, note, tx_hash, status, circle_id, created_at, from_user:users!payments_from_user_id_fkey(username), to_user:users!payments_to_user_id_fkey(username)"
        )
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    )
      .order("created_at", { ascending: false })
      .limit(cap),
    admin.from("split_members").select("payment_id").eq("user_id", userId).not("payment_id", "is", null),
    bound(
      admin
        .from("goal_contributions")
        .select("id, user_id, amount_usdc, tx_hash, created_at, goal:circle_goals(description)")
        .eq("user_id", userId)
    )
      .order("created_at", { ascending: false })
      .limit(cap),
    bound(
      admin
        .from("offramp_payouts")
        .select("id, user_id, amount_usdc, fee_usdc, target_currency, deposit_tx_hash, status, created_at")
        .eq("user_id", userId)
    )
      .order("created_at", { ascending: false })
      .limit(cap),
  ]);

  for (const r of [payments, splits, contributions, payouts]) {
    if (r.error) throw new Error(r.error.message);
  }

  const input: StatementInput = {
    userId,
    payments: (payments.data ?? []) as unknown as StatementInput["payments"],
    splitPaymentIds: (splits.data ?? []).map((s: { payment_id: string }) => s.payment_id),
    contributions: (contributions.data ?? []) as unknown as StatementInput["contributions"],
    payouts: (payouts.data ?? []) as unknown as StatementInput["payouts"],
  };
  const truncated = [payments, contributions, payouts].some((r) => (r.data?.length ?? 0) >= cap);
  return { rows: buildStatement(input, range), truncated };
}

/** Parse ?from= / ?to= (ISO timestamps). Returns an error message when one is not a real date or they are reversed. */
export function parseRange(params: URLSearchParams): { range: Range } | { error: string } {
  const range: Range = {};
  for (const key of ["from", "to"] as const) {
    const raw = params.get(key);
    if (!raw) continue;
    const t = Date.parse(raw);
    if (Number.isNaN(t)) return { error: `${key} is not a valid date` };
    range[key] = new Date(t).toISOString();
  }
  if (range.from && range.to && range.from > range.to) return { error: "from must not be after to" };
  return { range };
}
