import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TRACKER_ENABLED } from "@/lib/testnet";

export default function TestnetLayout({ children }: { children: ReactNode }) {
  if (!TRACKER_ENABLED) notFound();
  return children;
}
