import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { cleanRef } from "@/lib/referral";

/** An invite can only be attached while the account is new, so it can't be added to old accounts later. */
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/referrals/claim - body: { ref }
 * Records who invited the authenticated user. Called once from onboarding after the handle is
 * claimed. Never an error the user needs to see: a missing, unknown or late invite just isn't
 * attributed, so the response always says whether it was.
 */
export async function POST(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ref } = await req.json().catch(() => ({}));
  const username = cleanRef(ref);
  if (!username || user.referred_by) return NextResponse.json({ attributed: false });
  if (Date.now() - new Date(user.created_at).getTime() > CLAIM_WINDOW_MS) {
    return NextResponse.json({ attributed: false });
  }

  const admin = getSupabaseAdmin();
  const { data: referrer } = await admin
    .from("users")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();
  if (!referrer) return NextResponse.json({ attributed: false });

  // The is-null guard makes a second request a no-op rather than a rewrite.
  const { error } = await admin
    .from("users")
    .update({ referred_by: referrer.id })
    .eq("id", user.id)
    .is("referred_by", null);
  if (error) return NextResponse.json({ attributed: false });

  return NextResponse.json({ attributed: true });
}
