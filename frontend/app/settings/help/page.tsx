"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { NETWORK_LABEL } from "@/lib/network";
import { TELEGRAM_URL, X_URL } from "@/lib/community";

const LINK =
  "inline-flex items-center rounded-lg border border-line px-3.5 py-2 text-sm font-bold text-ink transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default function HelpSettingsPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<string | null>(null);
  const [debugCopied, setDebugCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ walletAddress: string | null }>("/api/circle/status")
      .then(({ walletAddress }) => setWallet(walletAddress))
      .catch(() => {});
  }, [user]);

  // What a bug report needs, without anything private (no email, phone or PIN).
  async function copyDebugInfo() {
    const commit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
    const info = [
      "Coven debug info",
      `Network: ${NETWORK_LABEL}`,
      `User: @${user?.username ?? "unknown"}`,
      `Wallet: ${wallet ?? "none"}`,
      ...(commit ? [`Version: ${commit}`] : []),
      `Browser: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(info);
      setDebugCopied(true);
      setTimeout(() => setDebugCopied(false), 1800);
    } catch {
      /* clipboard blocked: nothing to copy to */
    }
  }

  return (
    <AppShell title="Help and bug reports" subtitle="We read every report" back>
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-3">
          <div>
            <p className="text-sm font-bold text-ink">Report a problem</p>
            <p className="text-xs text-ink-mute">
              Copy your debug info and paste it into your report, with what you did, what you expected and what
              happened. It has no email, phone or PIN.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={copyDebugInfo}>
              {debugCopied ? "Debug info copied" : "Copy debug info"}
            </Button>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              Telegram <span aria-hidden="true" className="ml-1">↗</span>
            </a>
            <a href={X_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
              X <span aria-hidden="true" className="ml-1">↗</span>
            </a>
          </div>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-ink-mute">
          Never share your PIN, even with someone who says they work at Coven. See also our{" "}
          <Link href="/terms" className="font-semibold text-accent hover:underline">
            terms and privacy
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
