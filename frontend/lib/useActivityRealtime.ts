"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "./supabase";

/** Fired on window after notifications are marked read, so the bell can drop its badge without waiting for a poll. */
export const NOTIFICATIONS_READ_EVENT = "paycircle:notifications-read";

/**
 * Calls onChange whenever a row in the signed-in user's activity feed is inserted or updated.
 * Relies on the activity table being in the supabase_realtime publication and on its
 * "own activity" RLS policy, so each client only ever receives its own rows.
 */
export function useActivityRealtime(userId: string | undefined, onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`activity:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity", filter: `user_id=eq.${userId}` },
        () => cb.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
