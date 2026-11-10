/**
 * Market exchange rates for the "≈ local" estimates: how many units of a currency one US dollar
 * buys. USDC is pegged to the dollar, so this is also the USDC rate. It is the mid-market rate, not
 * what a payout would give (a payout adds the provider's spread and fees, quoted by Yellow Card).
 *
 * Two free public sources are tried in turn, each returning every currency at once, and the table is
 * kept for an hour. If both are down the last good table is used, and only then the fixed table below.
 */

export interface MarketRate {
  rate: number;
  /** Where the number came from. "fallback" means a fixed table, not a live rate. */
  source: "currency-api" | "open.er-api" | "fallback";
  /** When the source last updated its rates, if it says. */
  asOf: string | null;
  /** True when this is not a fresh live rate (last-known or fixed table). */
  stale: boolean;
}

type Table = { rates: Record<string, number>; source: MarketRate["source"]; asOf: string | null };

const SOURCES: { source: Table["source"]; url: string; read: (json: any) => Table | null }[] = [
  {
    source: "currency-api",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    read: (j) => (j?.usd ? { rates: upper(j.usd), source: "currency-api", asOf: j.date ?? null } : null),
  },
  {
    source: "open.er-api",
    url: "https://open.er-api.com/v6/latest/USD",
    read: (j) =>
      j?.result === "success" && j.rates
        ? { rates: upper(j.rates), source: "open.er-api", asOf: j.time_last_update_utc ?? null }
        : null,
  },
];

/** Last resort, only if every source is unreachable and nothing was ever fetched. Rates of 2026-11-10. */
const FALLBACK: Record<string, number> = { USD: 1, NGN: 1347, GHS: 11.7, KES: 129.9, ZAR: 16.4 };

const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 6_000;

let cached: { at: number; table: Table } | null = null;
let loading: Promise<Table | null> | null = null;

const upper = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toUpperCase(), Number(v)]));

async function fetchTable(): Promise<Table | null> {
  for (const s of SOURCES) {
    try {
      const res = await fetch(s.url, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 3600 } });
      if (!res.ok) continue;
      const table = s.read(await res.json());
      if (table && Number.isFinite(table.rates.NGN) && table.rates.NGN > 0) return table;
    } catch {
      /* try the next source */
    }
  }
  return null;
}

/** Units of `currency` per 1 USD (and so per 1 USDC). */
export async function getMarketRate(currency: string): Promise<MarketRate> {
  const code = currency.toUpperCase();
  if (code === "USD") return { rate: 1, source: "fallback", asOf: null, stale: false }; // the dollar itself

  if (!cached || Date.now() - cached.at > TTL_MS) {
    loading ??= fetchTable().finally(() => {
      loading = null;
    });
    const fresh = await loading;
    if (fresh) cached = { at: Date.now(), table: fresh };
  }

  const live = cached?.table.rates[code];
  if (cached && live !== undefined && Number.isFinite(live) && live > 0) {
    return { rate: live, source: cached.table.source, asOf: cached.table.asOf, stale: Date.now() - cached.at > TTL_MS };
  }
  const fixed = FALLBACK[code];
  if (!fixed) throw new Error(`No exchange rate for ${code}`);
  return { rate: fixed, source: "fallback", asOf: null, stale: true };
}

/** For tests: forget the cached table. */
export function resetMarketRates() {
  cached = null;
  loading = null;
}
