"use client";

import { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { Alert, Avatar, Card, Spinner } from "@/components/ui";
import { CameraIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";

export default function ProfileSettingsPage() {
  const { user, setUser } = useAuth();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <AppShell title="Profile" subtitle="How people see you on Coven" back>
      <div className="mx-auto max-w-xl space-y-5">
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
            <p className="truncate text-xl font-extrabold tracking-tight text-ink">@{user?.username ?? "…"}</p>
            <p className="text-xs font-semibold text-ink-mute">{user?.display_name || "Your Coven handle"}</p>
          </div>
        </Card>
        {avatarError && <Alert>{avatarError}</Alert>}
      </div>
    </AppShell>
  );
}
