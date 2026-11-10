"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import WalletSetup from "@/components/WalletSetup";
import { Button, Card, Skeleton } from "@/components/ui";
import { CheckCircleIcon, CopyIcon, LockIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { explorerAddressUrl } from "@/lib/explorer";

export default function WalletSettingsPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<string | null | undefined>(undefined);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api<{ walletAddress: string | null }>("/api/circle/status")
      .then(({ walletAddress }) => setWallet(walletAddress))
      .catch(() => setWallet(null));
  }, [user]);

  async function copyAddress() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <AppShell title="Wallet and PIN" subtitle="Your Arc wallet" back>
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <LockIcon className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold text-ink">Arc wallet PIN</span>
            </div>

            {wallet === undefined ? (
              <Skeleton className="h-6 w-16 rounded-full" />
            ) : wallet ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pos-line bg-pos-soft px-2.5 py-1 text-[0.6875rem] font-bold text-pos">
                <CheckCircleIcon className="h-3.5 w-3.5" /> Active
              </span>
            ) : (
              <Button size="sm" onClick={() => setShowSetup(true)}>
                Set PIN
              </Button>
            )}
          </div>

          {wallet && (
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <p className="amount min-w-0 flex-1 break-all text-xs text-ink-soft">{wallet}</p>
              <button
                onClick={copyAddress}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-soft transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copied ? <CheckCircleIcon className="h-3.5 w-3.5 text-pos" /> : <CopyIcon className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              {explorerAddressUrl(wallet) && (
                <a
                  href={explorerAddressUrl(wallet)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-soft transition-colors duration-200 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Explorer <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          )}
        </Card>

        <p className="px-1 text-xs leading-relaxed text-ink-mute">
          Coven never asks for your PIN. Anyone who does is not Coven.
        </p>

        {showSetup && (
          <WalletSetup
            onComplete={(addr) => {
              setWallet(addr);
              setShowSetup(false);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
