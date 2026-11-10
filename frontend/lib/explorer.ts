import { NETWORK } from "@/lib/network";

/**
 * Block explorer base URL. Testnet has a default; mainnet has none, so set NEXT_PUBLIC_EXPLORER_URL
 * there, otherwise addresses are shown without a link.
 */
export const EXPLORER_URL: string | undefined =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? (NETWORK === "testnet" ? "https://explorer.testnet.arc.io" : undefined);

export function explorerTxUrl(hash: string): string | undefined {
  return EXPLORER_URL ? `${EXPLORER_URL}/tx/${hash}` : undefined;
}

export function explorerAddressUrl(address: string): string | undefined {
  return EXPLORER_URL ? `${EXPLORER_URL}/address/${address}` : undefined;
}
