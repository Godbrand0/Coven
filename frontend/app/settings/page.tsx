"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import WalletSetup from "@/components/WalletSetup";
import {
  Avatar,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  Skeleton,
  Alert,
  SectionHeading,
} from "@/components/ui";
import {
  LockIcon,
  CreditCardIcon,
  CheckCircleIcon,
  CopyIcon,
  CameraIcon,
  BanknoteIcon,
  PlusIcon,
  LogoutIcon,
  UserGroupIcon,
} from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { NETWORK, NETWORK_LABEL } from "@/lib/network";
import { explorerAddressUrl } from "@/lib/explorer";
import { TELEGRAM_URL, X_URL } from "@/lib/community";
import { FAUCET_URL, STAGES } from "@/lib/testnet";
import type { Participant, TrackerData } from "@/lib/server/testnet-tracker";
import { referralLink } from "@/lib/referral";
import type { BankAccount } from "@/lib/types";

export default function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const [wallet, setWallet] = useState<string | null | undefined>(undefined);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const [invited, setInvited] = useState<number | null>(null);
  // undefined while loading, null when there is nothing to show (not on the tracker, or it failed).
  const [progress, setProgress] = useState<Participant | null | undefined>(undefined);
  const [debugCopied, setDebugCopied] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [addingBank, setAddingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankCode: "", accountNumber: "", accountName: "" });
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ walletAddress: string | null }>("/api/circle/status")
      .then(({ walletAddress }) => setWallet(walletAddress))
      .catch(() => setWallet(null));
    api<{ accounts: BankAccount[]; banks: { code: string; name: string }[] }>("/api/banks")
      .then(({ accounts, banks }) => {
        setAccounts(accounts);
        setBanks(banks);
      })
      .catch(() => {});
    api<{ count: number }>("/api/referrals")
      .then(({ count }) => setInvited(count))
      .catch(() => {});
    if (NETWORK === "testnet") {
      api<TrackerData>("/api/testnet")
        .then((t) => setProgress(t.participants.find((p) => p.username === user.username) ?? null))
        .catch(() => setProgress(null));
    }
  }, [user]);

  const inviteLink = user ? referralLink(window.location.origin, user.username) : "";

  // Desktop and in-app browsers can expose a share sheet that never appears, so only phones get one.
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteNote("Copied");
    } catch {
      inviteInputRef.current?.select();
      setInviteNote("Press ⌘C / Ctrl+C to copy");
    }
    setTimeout(() => setInviteNote(""), 2200);
  }

  async function shareInvite() {
    try {
      await navigator.share({
        title: "Join me on Coven",
        text: `Pay me on Coven: @${user?.username}`,
        url: inviteLink,
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copyInvite();
    }
  }

  async function copyAddress() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { avatarUrl } = await api<{ avatarUrl: string }>("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      setUser((u) => (u ? { ...u, avatar_url: avatarUrl } : u));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addBank() {
    setBankBusy(true);
    setBankError("");
    try {
      const { account } = await api<{ account: BankAccount }>("/api/banks", {
        json: { ...bankForm, country: "NG", currency: "NGN", isDefault: accounts.length === 0 },
      });
      setAccounts((a) => [account, ...a]);
      setAddingBank(false);
      setBankForm({ bankCode: "", accountNumber: "", accountName: "" });
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Could not save bank");
    } finally {
      setBankBusy(false);
    }
  }

  return (
    <AppShell title="Settings" subtitle="Your handle, wallet and payouts">
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2 lg:items-start">
        {/* ------------------------------------------------------- Profile */}
        <div className="space-y-5">
          <Card className="flex items-center gap-4 py-5">
            <div className="relative">
              <Avatar username={user?.username ?? "?"} avatarUrl={user?.avatar_url} size={64} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand text-white ring-4 ring-surface transition-[background-color,translate,scale] duration-200 ease-out-soft hover:bg-brand-hover active:scale-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {avatarBusy ? <Spinner /> : <CameraIcon className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight text-ink">
                @{user?.username ?? "…"}
              </p>
              <p className="text-xs font-semibold text-ink-mute">
                {user?.display_name || "Your Coven handle"}
              </p>
            </div>
          </Card>

          {avatarError && <Alert>{avatarError}</Alert>}

          {/* Wallet */}
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
                  {copied ? (
                    <CheckCircleIcon className="h-3.5 w-3.5 text-pos" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
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

          {/* Testnet only: how far this tester is through the eligibility stages */}
          {NETWORK === "testnet" && progress !== null && (
            <Card className="space-y-3">
              {progress === undefined ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">Your testnet progress</p>
                      <p className="text-xs text-ink-mute">
                        {STAGES.filter((s) => s.required && progress.stages[s.id]).length} of{" "}
                        {STAGES.filter((s) => s.required).length} required stages
                      </p>
                    </div>
                    {progress.eligible && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-pos-line bg-pos-soft px-2.5 py-1 text-[0.6875rem] font-bold text-pos">
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Eligible
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {STAGES.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-sm">
                        {progress.stages[s.id] ? (
                          <CheckCircleIcon className="h-4 w-4 shrink-0 text-pos" />
                        ) : (
                          <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-line-strong" />
                        )}
                        <span className={progress.stages[s.id] ? "text-ink" : "text-ink-soft"}>
                          {s.label}
                          {!s.required && <span className="text-ink-mute"> (optional)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-mute">
                    Updates about every 30 seconds.{" "}
                    <Link href="/testnet" className="font-semibold text-accent hover:underline">
                      See the full tracker
                    </Link>
                  </p>
                </>
              )}
            </Card>
          )}

          {/* Testnet only: where to get free test USDC */}
          {NETWORK === "testnet" && wallet && (
            <Card className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <BanknoteIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Get free test USDC</p>
                  <p className="text-xs text-ink-mute">
                    Copy your address, then on Circle&apos;s faucet pick Arc Testnet and USDC and paste it in.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={copyAddress}>
                  {copied ? "Address copied" : "Copy my address"}
                </Button>
                <a
                  href={FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg bg-ink px-3.5 py-2 text-sm font-bold text-surface transition-colors duration-200 hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Open Circle faucet <span aria-hidden="true" className="ml-1">↗</span>
                </a>
              </div>
            </Card>
          )}

          {/* Help */}
          <Card className="space-y-3">
            <div>
              <p className="text-sm font-bold text-ink">Help and bug reports</p>
              <p className="text-xs text-ink-mute">
                Copy your debug info and paste it into your report. It has no email, phone or PIN.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={copyDebugInfo}>
                {debugCopied ? "Debug info copied" : "Copy debug info"}
              </Button>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-line px-3.5 py-2 text-sm font-bold text-ink transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Telegram <span aria-hidden="true" className="ml-1">↗</span>
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-line px-3.5 py-2 text-sm font-bold text-ink transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                X <span aria-hidden="true" className="ml-1">↗</span>
              </a>
            </div>
          </Card>

          {/* Invite */}
          <Card className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                <UserGroupIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Invite friends</p>
                <p className="text-xs text-ink-mute">
                  {invited ? `${invited} joined through your link` : "Share your link so friends can pay you"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-line pt-3">
              <input
                ref={inviteInputRef}
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Your invite link"
                className="min-w-0 flex-1 rounded-lg bg-surface-2 px-2.5 py-2 text-xs text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button size="sm" onClick={copyInvite}>
                Copy
              </Button>
              {canShare && (
                <Button size="sm" variant="secondary" onClick={shareInvite}>
                  Share
                </Button>
              )}
            </div>
            {inviteNote && (
              <p role="status" className="text-xs font-semibold text-pos">
                {inviteNote}
              </p>
            )}
          </Card>

          {showSetup && (
            <WalletSetup
              onComplete={(addr) => {
                setWallet(addr);
                setShowSetup(false);
              }}
            />
          )}

          {/* Network */}
          <Card className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
              <CreditCardIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Network</p>
              <p className="text-xs text-ink-mute">
                {NETWORK_LABEL} · sub-500ms settlement · zero gas on P2P
              </p>
            </div>
          </Card>
        </div>

        {/* --------------------------------------------------------- Banks */}
        <div className="space-y-5">
          <Card className="space-y-3.5">
            <SectionHeading
              title="Bank accounts"
              count={accounts.length}
              action={
                <button
                  onClick={() => setAddingBank((s) => !s)}
                  className="inline-flex items-center gap-1 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {addingBank ? (
                    "Cancel"
                  ) : (
                    <>
                      <PlusIcon className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </button>
              }
            />

            {accounts.length === 0 && !addingBank && (
              <p className="text-xs leading-relaxed text-ink-soft">
                None saved yet. Add one so you can cash out USDC straight to
                your bank.
              </p>
            )}

            {accounts.length > 0 && (
              <ul className="divide-y divide-line">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
                      <BanknoteIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{a.bank_name}</p>
                      <p className="tnum truncate text-xs text-ink-mute">
                        ···· {a.account_last4} · {a.account_name}
                      </p>
                    </div>
                    {a.is_default && (
                      <span className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-bold text-accent">
                        Default
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {addingBank && (
              <div className="animate-fade-up space-y-3.5 border-t border-line pt-3.5">
                <Select
                  label="Bank"
                  value={bankForm.bankCode}
                  onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
                >
                  <option value="">Select bank</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Account number"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0123456789"
                  value={bankForm.accountNumber}
                  onChange={(e) =>
                    setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))
                  }
                />
                <Input
                  label="Account name"
                  placeholder="As it appears on your bank statement"
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
                />
                {bankError && <Alert>{bankError}</Alert>}
                <Button
                  fullWidth
                  onClick={addBank}
                  loading={bankBusy}
                  disabled={
                    !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
                  }
                >
                  Save bank account
                </Button>
              </div>
            )}
          </Card>

          {/* Sign out sits apart from everything else, on purpose. */}
          <div className="border-t border-line pt-5">
            <Button
              variant="danger"
              fullWidth
              icon={<LogoutIcon className="h-4 w-4" />}
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
