import { redirect } from "next/navigation";
import { cleanRef } from "@/lib/referral";

/** /r/<username> - an invite link. Lands on signup with the inviter attached. */
export default async function InvitePage({ params }: { params: Promise<{ username: string }> }) {
  const ref = cleanRef((await params).username);
  redirect(ref ? `/signup?ref=${ref}` : "/signup");
}
