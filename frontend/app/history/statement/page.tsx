"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";
import { NETWORK_LABEL } from "@/lib/network";
import { STATEMENT_KINDS, type StatementRow, type Totals } from "@/lib/statement-types";

type Page = { rows: StatementRow[]; nextOffset: number | null; totals: Totals; truncated: boolean };

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "long" });

/**
 * A printable statement for a date range: "Print or save as PDF" in the browser makes the file. The
 * sheet uses fixed light colors, not the app's theme tokens, so it prints the same in dark mode.
 */
export default function StatementPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [generatedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    setFrom(params.get("from"));
    setTo(params.get("to"));
    let stale = false;
    (async () => {
      const all: StatementRow[] = [];
      let offset = 0;
      for (;;) {
        const q = new URLSearchParams();
        for (const k of ["from", "to"]) if (params.get(k)) q.set(k, params.get(k)!);
        q.set("limit", "1000");
        q.set("offset", String(offset));
        const p = await api<Page>(`/api/history?${q}`);
        if (stale) return;
        all.push(...p.rows);
        setTotals(p.totals);
        setTruncated(p.truncated);
        if (p.nextOffset === null) break;
        offset = p.nextOffset;
      }
      setRows(all);
    })().catch((e) => !stale && setError(e instanceof Error ? e.message : "Could not load your statement"));
    return () => {
      stale = true;
    };
  }, [user]);

  const period = useMemo(() => {
    if (!from && !to) return "All time";
    return `${from ? day(from) : "The beginning"} to ${to ? day(to) : day(generatedAt)}`;
  }, [from, to, generatedAt]);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-6 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>

      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 print:hidden">
        <a href="/history" className="text-sm font-semibold text-neutral-700 hover:underline">
          ← Back to history
        </a>
        <button
          onClick={() => window.print()}
          disabled={rows === null}
          className="cursor-pointer rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print or save as PDF
        </button>
      </div>

      <article className="mx-auto max-w-4xl bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-5">
          <div>
            <p className="text-2xl font-extrabold tracking-tight">Coven</p>
            <p className="text-sm text-neutral-600">Account statement</p>
          </div>
          <dl className="text-right text-sm">
            <dt className="sr-only">Account</dt>
            <dd className="font-bold">@{user?.username ?? "…"}</dd>
            {user?.wallet_address && <dd className="break-all font-mono text-xs text-neutral-600">{user.wallet_address}</dd>}
            <dd className="text-neutral-600">{NETWORK_LABEL} · USDC</dd>
          </dl>
        </header>

        <section className="grid gap-4 border-b border-neutral-300 py-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Period</p>
            <p className="font-semibold">{period}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Generated {when(generatedAt)} · times in {timeZone}
            </p>
          </div>
          {totals && (
            <dl className="grid grid-cols-3 gap-3 text-right">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">In</dt>
                <dd className="font-bold tabular-nums">+{formatUSDC(totals.moneyIn)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">Out</dt>
                <dd className="font-bold tabular-nums">−{formatUSDC(totals.moneyOut)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-neutral-500">Fees</dt>
                <dd className="font-bold tabular-nums">{formatUSDC(totals.fees)}</dd>
              </div>
            </dl>
          )}
        </section>

        {error ? (
          <p role="alert" className="py-8 text-sm text-red-700">
            {error}
          </p>
        ) : rows === null ? (
          <p className="py-8 text-sm text-neutral-500">Preparing your statement…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-sm text-neutral-500">No transactions in this period.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-400 text-[0.6875rem] uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-3 font-bold">Date</th>
                <th className="py-2 pr-3 font-bold">Details</th>
                <th className="py-2 pr-3 font-bold">Status</th>
                <th className="py-2 pr-3 text-right font-bold">Fee</th>
                <th className="py-2 text-right font-bold">Amount (USDC)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="break-inside-avoid border-b border-neutral-200 align-top">
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{when(r.at)}</td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{STATEMENT_KINDS[r.kind].label}</span>
                    {r.counterparty && <span> · {r.kind === "goal_contribution" ? r.counterparty : `@${r.counterparty}`}</span>}
                    {r.note && <span className="block text-neutral-500">{r.note}</span>}
                    {r.txHash && <span className="block break-all font-mono text-[0.625rem] text-neutral-400">{r.txHash}</span>}
                  </td>
                  <td className="py-2 pr-3 capitalize">{r.status}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.fee ? formatUSDC(r.fee) : "—"}</td>
                  <td className="whitespace-nowrap py-2 text-right font-bold tabular-nums">
                    {r.direction === "in" ? "+" : "−"}
                    {formatUSDC(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {truncated && (
          <p className="mt-4 text-xs text-neutral-600">This period has a very large number of transactions; narrow the dates to include them all.</p>
        )}
        <footer className="mt-8 border-t border-neutral-300 pt-4 text-[0.6875rem] leading-relaxed text-neutral-500">
          Totals count settled transactions only; pending and failed items are listed but not counted. Amounts are USDC. This statement
          lists activity recorded by Coven and is not a bank statement.
        </footer>
      </article>
    </div>
  );
}
