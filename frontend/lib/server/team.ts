/**
 * Core-team access for internal pages such as the testnet tracker. Two ways in:
 *
 * - The shared access code in TESTNET_ACCESS_CODE, sent as the `x-access-code` header.
 * - Signing in with a Google email listed in TESTNET_TEAM_EMAILS (comma separated). The email is
 *   read from the verified Supabase session, not from anything the client sends.
 *
 * With both variables empty, nobody gets in.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

export const ACCESS_CODE_HEADER = "x-access-code";

export function teamEmails(): Set<string> {
  return new Set(
    (process.env.TESTNET_TEAM_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Constant-time comparison, so response timing does not reveal how much of a guess was right. */
function codeMatches(given: string): boolean {
  const expected = process.env.TESTNET_ACCESS_CODE?.trim();
  if (!expected || !given) return false;
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(given.trim()), hash(expected));
}

/**
 * "team" when the request carries the access code or a core-team sign-in; "locked" when it carries
 * neither; "forbidden" when it tried (a wrong code, or an email not on the list).
 */
export async function teamAccess(req: Request): Promise<"team" | "locked" | "forbidden"> {
  const code = req.headers.get(ACCESS_CODE_HEADER);
  if (code && codeMatches(code)) return "team";

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    const email = !error ? data.user?.email?.toLowerCase() : undefined;
    if (email && teamEmails().has(email)) return "team";
  }

  return code ? "forbidden" : "locked";
}
