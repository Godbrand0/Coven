import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { syncInboundTransfers } from "@/lib/server/inbound-sync";
import { loadStatement, parseRange, toCsv } from "@/lib/server/statement";

const EXPORT_CAP = 20_000;

/**
 * GET /api/history/export?from=&to= - the statement for the date range as a CSV file download.
 * Amounts are signed (+ in, - out) and times are UTC.
 */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = parseRange(new URL(req.url).searchParams);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (user.circle_wallet_id) {
    await syncInboundTransfers(user.id, user.circle_wallet_id).catch((e) =>
      console.error("Inbound transfer sync failed:", e)
    );
  }

  try {
    const { rows } = await loadStatement(user.id, parsed.range, EXPORT_CAP);
    const day = (iso?: string) => (iso ? iso.slice(0, 10) : null);
    const span = [day(parsed.range.from) ?? "start", day(parsed.range.to) ?? "today"].join("_to_");
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="coven-statement-${user.username}-${span}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("Statement export failed:", e);
    return NextResponse.json({ error: "Could not export your history" }, { status: 502 });
  }
}
