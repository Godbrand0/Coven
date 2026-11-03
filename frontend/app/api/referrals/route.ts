import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";

/** GET /api/referrals - how many people joined through the caller's invite link. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await getSupabaseAdmin()
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", user.id);

  return NextResponse.json({ count: count ?? 0 });
}
