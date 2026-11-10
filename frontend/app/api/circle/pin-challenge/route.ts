import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { createPinChallenge, getCircleUserToken } from "@/lib/circle/wallets";

/**
 * POST /api/circle/pin-challenge { kind: "change" | "restore" }
 * Starts a PIN change (knows the current PIN) or a PIN reset (forgot it) for the authed user. Returns
 * the userToken/encryptionKey/challengeId the client runs in Circle's PIN widget; nothing changes
 * until the user finishes it there.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.circle_wallet_id) {
    return NextResponse.json({ error: "Set up your wallet first" }, { status: 400 });
  }

  const { kind } = (await req.json().catch(() => ({}))) as { kind?: string };
  if (kind !== "change" && kind !== "restore") {
    return NextResponse.json({ error: "kind must be change or restore" }, { status: 400 });
  }

  try {
    const { userToken, encryptionKey } = await getCircleUserToken(user.id);
    const { challengeId } = await createPinChallenge(userToken, kind);
    return NextResponse.json({ userToken, encryptionKey, challengeId });
  } catch (e) {
    console.error("Circle PIN challenge failed:", e);
    return NextResponse.json({ error: "Could not start the PIN change. Try again." }, { status: 502 });
  }
}
