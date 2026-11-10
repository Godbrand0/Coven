/** Shared by the statement API and the History page: no imports, so it is safe in the browser. */

export type StatementKind =
  | "sent"
  | "received"
  | "deposit"
  | "circle_send"
  | "split_pay"
  | "goal_contribution"
  | "goal_payout"
  | "cash_out";

export const STATEMENT_KINDS: Record<StatementKind, { label: string; direction: "in" | "out" }> = {
  sent: { label: "Sent", direction: "out" },
  received: { label: "Received", direction: "in" },
  deposit: { label: "Deposit", direction: "in" },
  circle_send: { label: "Circle payment", direction: "out" },
  split_pay: { label: "Split payment", direction: "out" },
  goal_contribution: { label: "Goal contribution", direction: "out" },
  goal_payout: { label: "Goal payout", direction: "in" },
  cash_out: { label: "Cash out", direction: "out" },
};

export interface StatementRow {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: StatementKind;
  direction: "in" | "out";
  /** Always positive; `direction` says which way it went. */
  amount: number;
  fee: number;
  /** @username, or what the money went to (a goal). Null for deposits and cash outs. */
  counterparty: string | null;
  note: string | null;
  txHash: string | null;
  /** completed | pending | failed for payments; pending | processing | completed | failed for cash outs. */
  status: string;
}

export interface Totals {
  moneyIn: number;
  moneyOut: number;
  fees: number;
  count: number;
}
