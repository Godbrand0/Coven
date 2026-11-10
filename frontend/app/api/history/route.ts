import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { syncInboundTransfers } from "@/lib/server/inbound-sync";
import { loadStatement, parseRange, summarize } from "@/lib/server/statement";

const PAGE_SIZE = 25;

/**
 * GET /api/history?from=&to=&direction=all|in|out&offset=0&limit=25
 * The user's statement: every movement of their money in the date range (ISO timestamps, inclusive),
 * newest first, one page at a time. `totals` cover the whole range, not just this page.
 */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const parsed = parseRange(params);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const direction = params.get("direction") ?? "all";
  if (!["all", "in", "out"].includes(direction)) {
    return NextResponse.json({ error: "direction must be all, in or out" }, { status: 400 });
  }
  const offset = Math.max(0, Math.floor(Number(params.get("offset") ?? 0)) || 0);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.get("limit") ?? PAGE_SIZE)) || PAGE_SIZE));

  // Pick up deposits made from outside Coven (the faucet, another wallet) before reading.
  if (offset === 0 && user.circle_wallet_id) {
    await syncInboundTransfers(user.id, user.circle_wallet_id).catch((e) =>
      console.error("Inbound transfer sync failed:", e)
    );
  }

  try {
    const { rows, truncated } = await loadStatement(user.id, parsed.range);
    const shown = direction === "all" ? rows : rows.filter((r) => r.direction === direction);
    const page = shown.slice(offset, offset + limit);
    return NextResponse.json({
      rows: page,
      total: shown.length,
      nextOffset: offset + limit < shown.length ? offset + limit : null,
      totals: summarize(rows),
      truncated,
    });
  } catch (e) {
    console.error("Statement failed:", e);
    return NextResponse.json({ error: "Could not load your history" }, { status: 502 });
  }
}
