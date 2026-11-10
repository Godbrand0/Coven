"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/Icons";

/** A titled group of tappable rows, like the grouped lists in a phone's own Settings. */
export function SettingsGroup({ title, tone = "default", children }: {
  title?: string;
  /** "danger" outlines the group in red, for sign out and other irreversible actions. */
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {title && (
        <h2 className={`px-1 text-xs font-bold uppercase tracking-[0.08em] ${tone === "danger" ? "text-neg" : "text-ink-mute"}`}>
          {title}
        </h2>
      )}
      <div
        className={`divide-y overflow-hidden rounded-xl border bg-surface shadow-e1 ${
          tone === "danger" ? "divide-neg-line border-neg-line" : "divide-line border-line"
        }`}
      >
        {children}
      </div>
    </section>
  );
}

const ROW =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

export function SettingsRow({ icon, label, hint, href, external, onClick, tone = "default" }: {
  icon: ReactNode;
  label: string;
  hint?: string;
  href?: string;
  /** Opens in a new tab. */
  external?: boolean;
  onClick?: () => void;
  tone?: "default" | "danger";
}) {
  const body = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          tone === "danger" ? "bg-neg-soft text-neg" : "bg-accent-soft text-accent"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${tone === "danger" ? "text-neg" : "text-ink"}`}>{label}</span>
        {hint && <span className="block truncate text-xs text-ink-mute">{hint}</span>}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-mute" />
    </>
  );

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={ROW}>
        {body}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={ROW}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${ROW} cursor-pointer`}>
      {body}
    </button>
  );
}
