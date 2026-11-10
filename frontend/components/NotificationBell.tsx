"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { NotificationBellIcon } from "./Icons";
import { useAuth } from "@/lib/useAuth";
import { useActivityRealtime, NOTIFICATIONS_READ_EVENT } from "@/lib/useActivityRealtime";

// Realtime pushes changes instantly; the poll is only a safety net for a dropped socket.
const POLL_MS = 120_000;

/** Bell with an unread-count badge, linking to /notifications. */
export default function NotificationBell() {
  const { user } = useAuth({ optional: true });
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const { count } = await api<{ count: number }>("/api/notifications/unread-count");
      setCount(count);
    } catch {
      // Stay quiet; the bell just won't update this cycle.
    }
  }, []);

  useActivityRealtime(user?.id, fetchCount);

  useEffect(() => {
    function poll() {
      // Skip work while the tab is hidden; it resyncs on focus anyway.
      if (document.visibilityState !== "hidden") fetchCount();
    }
    const onRead = () => setCount(0);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    poll();
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    };
  }, [fetchCount]);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-[background-color,color,translate,scale] duration-200 ease-out-soft hover:bg-surface-2 hover:text-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <NotificationBellIcon className="h-5 w-5" />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="tnum animate-scale-in absolute right-1.5 top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-neg px-1 text-[10px] font-bold text-white ring-2 ring-surface"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
