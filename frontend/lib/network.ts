/**
 * Which Arc network this deployment talks to. A deployment serves exactly one network, chosen by
 * NEXT_PUBLIC_NETWORK ("testnet" by default). Testnet and mainnet run as separate deployments with
 * their own env vars, database and Circle credentials, so nothing here switches at runtime.
 *
 * On mainnet the env is checked before any chain or Circle call, so a testnet value left in a
 * mainnet deployment (or a live Circle key in a testnet one) fails loudly instead of quietly
 * running against the wrong network.
 */
export type Network = "testnet" | "mainnet";

export const NETWORK: Network = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";

const CONFIG = {
  testnet: { label: "Arc Testnet", chainId: 5042002, circleBlockchain: "ARC-TESTNET" },
  mainnet: { label: "Arc Mainnet", chainId: 5042, circleBlockchain: "ARC" },
} as const;

export const NETWORK_LABEL = CONFIG[NETWORK].label;
export const ARC_CHAIN_ID = CONFIG[NETWORK].chainId;
export const CIRCLE_BLOCKCHAIN = CONFIG[NETWORK].circleBlockchain;

type Env = Record<string, string | undefined>;

const MAINNET_REQUIRED = [
  "ARC_RPC_URL",
  "ARC_USDC_ADDRESS",
  "ARC_USDC_TOKEN_ID",
  "NEXT_PUBLIC_PAYCIRCLE_CONTRACT",
  "NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT",
  "NEXT_PUBLIC_GOAL_POOL_CONTRACT",
  "CIRCLE_API_KEY",
  "NEXT_PUBLIC_CIRCLE_APP_ID",
  "RELAYER_PRIVATE_KEY",
];

/** Everything wrong with `env` for the given network. Empty means it is consistent. */
export function validateNetworkEnv(network: Network, env: Env): string[] {
  const problems: string[] = [];
  const key = env.CIRCLE_API_KEY ?? "";

  if (network === "testnet") {
    if (key.startsWith("LIVE_API_KEY")) problems.push("CIRCLE_API_KEY is a live (mainnet) key on a testnet deployment");
    return problems;
  }

  for (const name of MAINNET_REQUIRED) if (!env[name]) problems.push(`${name} is not set`);
  if (key.startsWith("TEST_API_KEY")) problems.push("CIRCLE_API_KEY is a test key on a mainnet deployment");
  if (env.ARC_CHAIN_ID !== String(CONFIG.mainnet.chainId)) problems.push(`ARC_CHAIN_ID must be ${CONFIG.mainnet.chainId}`);
  if (env.CIRCLE_BLOCKCHAIN && env.CIRCLE_BLOCKCHAIN !== CONFIG.mainnet.circleBlockchain) {
    problems.push(`CIRCLE_BLOCKCHAIN must be ${CONFIG.mainnet.circleBlockchain}`);
  }
  if (env.ARC_RPC_URL?.includes("testnet")) problems.push("ARC_RPC_URL points at a testnet endpoint");
  return problems;
}

/** Throws if this deployment's env does not match its network. Cheap; safe to call per request. */
export function assertNetworkEnv(): void {
  const problems = validateNetworkEnv(NETWORK, process.env);
  if (problems.length) throw new Error(`Invalid ${NETWORK} configuration: ${problems.join("; ")}`);
}

/** Cross-chain (CCTP) payments are testnet-only until the burn side exists. */
export function assertCrossChainEnabled(): void {
  if (NETWORK === "mainnet") throw new Error("Cross-chain payments are not enabled on mainnet");
}
