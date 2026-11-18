"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowser } from "./supabase";

/** Fired on window after notifications are marked read, so the bell can drop its badge without waiting for a poll. */
export const NOTIFICATIONS_READ_EVENT = "paycircle:notifications-read";

// Every listener needs its own channel. Supabase hands back the existing channel for a repeated
// name, and adding a listener to a channel that is already subscribed throws, which crashed the
// Notifications page (the header bell and the page both listen for the same user).
let channelSeq = 0;

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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`activity:${userId}:${++channelSeq}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "activity", filter: `user_id=eq.${userId}` },
          () => cb.current()
        )
        .subscribe();
    } catch (e) {
      // Live updates are an enhancement: the bell still polls, so never let this break a page.
      console.warn("[realtime] could not subscribe:", (e as Error).message);
    }
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);
}
