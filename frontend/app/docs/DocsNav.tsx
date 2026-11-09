"use client";

import { useEffect, useState } from "react";

export interface NavGroup {
  title: string;
  items: { id: string; label: string }[];
}

/** Contents for the docs page: a sticky sidebar on desktop, a jump menu on phones. Highlights the section in view. */
export default function DocsNav({ groups }: { groups: NavGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // ids come from a static list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Phones and tablets: a jump menu pinned under the header */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-canvas/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <label className="sr-only" htmlFor="docs-jump">Jump to section</label>
        <select
          id="docs-jump"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" });
          }}
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink"
        >
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop: sticky sidebar */}
      <nav aria-label="Documentation" className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto pb-8 pr-2 lg:block">
        {groups.map((g) => (
          <div key={g.title} className="mb-6">
            <p className="mb-2 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-mute">{g.title}</p>
            <ul className="space-y-0.5 border-l border-line">
              {g.items.map((i) => (
                <li key={i.id}>
                  <a
                    href={`#${i.id}`}
                    className={`-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors ${
                      active === i.id
                        ? "border-accent font-semibold text-accent"
                        : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
                    }`}
                  >
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
