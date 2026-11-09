import { NextResponse } from "next/server";
import { buildTracker, loadTrackerInput, type TrackerData } from "@/lib/server/testnet-tracker";

/**
 * GET /api/testnet - public testnet tracker: totals, each tester's progress through the eligibility
 * stages, and the latest transactions. Shows usernames and wallet addresses (both already public on
 * profiles and on-chain), never emails or phone numbers.
 *
 * Rebuilt at most every 30 seconds per server instance, so a busy tracker page does not re-read
 * every table on each refresh.
 */
const TTL_MS = 30_000;
let cached: { at: number; data: TrackerData } | null = null;
let building: Promise<TrackerData> | null = null;

export async function GET() {
  try {
    if (!cached || Date.now() - cached.at > TTL_MS) {
      building ??= loadTrackerInput()
        .then((input) => buildTracker(input))
        .finally(() => {
          building = null;
        });
      cached = { at: Date.now(), data: await building };
    }
    return NextResponse.json(cached.data, { headers: { "cache-control": "public, max-age=15" } });
  } catch (e) {
    console.error("testnet tracker failed", e);
    return NextResponse.json({ error: "Tracker is unavailable right now" }, { status: 503 });
  }
}
