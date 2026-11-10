"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { UserGroupIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import { referralLink } from "@/lib/referral";

export default function InviteSettingsPage() {
  const { user } = useAuth();
  const [inviteNote, setInviteNote] = useState("");
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const [invited, setInvited] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ count: number }>("/api/referrals")
      .then(({ count }) => setInvited(count))
      .catch(() => {});
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

  return (
    <AppShell title="Invite friends" subtitle="Share your link so friends can pay you" back>
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UserGroupIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Your invite link</p>
              <p className="text-xs text-ink-mute">
                {invited ? `${invited} joined through your link` : "Nobody has joined through it yet"}
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
      </div>
    </AppShell>
  );
}
