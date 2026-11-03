import { validateUsername } from "@/lib/format";

const STORAGE_KEY = "coven:ref";

/** A username from an invite link, or null if it isn't one. */
export function cleanRef(value: string | null | undefined): string | null {
  const ref = String(value ?? "").replace(/^@/, "").toLowerCase();
  return validateUsername(ref) ? null : ref;
}

export function referralLink(origin: string, username: string): string {
  return `${origin}/r/${username}`;
}

/**
 * The Google sign-in round trip drops the query string, so the invite is held in
 * localStorage until onboarding claims it. Storage can be blocked; a lost invite
 * just means the signup isn't attributed.
 */
export function stashRef(value: string | null | undefined) {
  const ref = cleanRef(value);
  if (!ref) return;
  try {
    localStorage.setItem(STORAGE_KEY, ref);
  } catch {}
}

export function pendingRef(): string | null {
  try {
    return cleanRef(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearRef() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
