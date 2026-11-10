"use client";

import { api } from "@/lib/api-client";
import { runChallenge, type ChallengeCredentials } from "./challenge";

/**
 * Change the wallet PIN ("change", needs the current one) or reset a forgotten one ("restore", uses the
 * security questions). Circle's widget asks for the PINs; resolves when it finishes, rejects if the
 * user cancels or Circle refuses.
 */
export async function changePin(kind: "change" | "restore"): Promise<void> {
  const creds = await api<ChallengeCredentials>("/api/circle/pin-challenge", { json: { kind } });
  await runChallenge(creds);
}
