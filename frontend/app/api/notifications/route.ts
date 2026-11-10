import { NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthedUser } from "@/lib/supabase";
import { toNotification, notificationHref } from "@/lib/server/notifications";

/**
 * GET /api/notifications - the activity feed, adapted to {title, body}
 * for the notifications page. Most activity types' actor_id already is
 * the counterparty; payment_sent is the exception (actor_id is the
 * sender themselves), so its real recipient is resolved via the linked
 * payment separately.
 */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data: activity, error } = await admin
    .from("activity")
    .select("*, actor:users!activity_actor_id_fkey(id, username)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const sentIds = (activity ?? [])
    .filter((a) => a.type === "payment_sent" && a.reference_id)
    .map((a) => a.reference_id);

  const recipientByPaymentId = new Map<string, string>();
  if (sentIds.length > 0) {
    const { data: payments } = await admin
      .from("payments")
      .select("id, to_user:users!payments_to_user_id_fkey(username)")
      .in("id", sentIds);
    for (const p of payments ?? []) {
      const toUser = p.to_user as unknown as { username: string } | null;
      if (toUser) recipientByPaymentId.set(p.id, toUser.username);
    }
  }

  // Goal and split activity points at the goal/split row; fetch their circles in two bulk lookups.
  const refsOf = (prefix: string) =>
    (activity ?? []).filter((a) => a.type.startsWith(prefix) && a.reference_id).map((a) => a.reference_id);
  const circleByRef = new Map<string, string>();
  const [goalRefs, splitRefs] = [refsOf("goal_"), refsOf("split_")];
  if (goalRefs.length > 0) {
    const { data } = await admin.from("circle_goals").select("id, circle_id").in("id", goalRefs);
    for (const g of data ?? []) circleByRef.set(g.id, g.circle_id);
  }
  if (splitRefs.length > 0) {
    const { data } = await admin.from("splits").select("id, circle_id").in("id", splitRefs);
    for (const s of data ?? []) if (s.circle_id) circleByRef.set(s.id, s.circle_id);
  }

  const notifications = (activity ?? []).map((a) => {
    const counterparty =
      a.type === "payment_sent" && a.reference_id
        ? recipientByPaymentId.get(a.reference_id)
        : undefined;
    const { title, body } = toNotification(a, counterparty);
    const href = notificationHref(a, a.reference_id ? circleByRef.get(a.reference_id) : null);
    return { id: a.id, title, body, read: a.read, created_at: a.created_at, href };
  });

  return NextResponse.json({ notifications });
}
