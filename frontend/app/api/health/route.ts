import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ARC_CHAIN_ID, NETWORK, validateNetworkEnv } from "@/lib/network";

/**
 * GET /api/health - is every system a tester's payment depends on up right now?
 *
 * Answers 200 when every critical check passes and 503 when any fails, so an uptime monitor can
 * watch it directly. Anyone gets `{ ok }`; the per-check detail (relayer address and balance, missing
 * settings, database errors) is returned only to a caller sending `Authorization: Bearer <HEALTH_TOKEN>`,
 * and never when HEALTH_TOKEN is unset. Results are shared for a few seconds so it cannot be used to
 * hammer Circle, the RPC and the database.
 */
type Check = { name: string; ok: boolean; critical: boolean; detail: string; ms: number };

const TIMEOUT_MS = 8_000;
const CACHE_MS = 10_000;

let cached: { at: number; checks: Check[] } | null = null;
let running: Promise<Check[]> | null = null;

function detailAllowed(req: Request): boolean {
  const token = process.env.HEALTH_TOKEN;
  const header = req.headers.get("authorization") ?? "";
  if (!token || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(name: string, critical: boolean, fn: () => Promise<string>): Promise<Check> {
  const start = Date.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), TIMEOUT_MS)),
    ]);
    return { name, ok: true, critical, detail, ms: Date.now() - start };
  } catch (e) {
    return { name, ok: false, critical, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - start };
  }
}

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ARC_RPC_URL",
  "ARC_USDC_ADDRESS",
  "ARC_USDC_TOKEN_ID",
  "NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT",
  "NEXT_PUBLIC_GOAL_POOL_CONTRACT",
  "CIRCLE_API_KEY",
  "NEXT_PUBLIC_CIRCLE_APP_ID",
  "NEXT_PUBLIC_APP_URL",
];

async function runChecks(): Promise<Check[]> {
  const provider = process.env.ARC_RPC_URL ? new ethers.JsonRpcProvider(process.env.ARC_RPC_URL, undefined, { staticNetwork: true }) : null;

  const hasCode = (envName: string) => async () => {
    const address = process.env[envName];
    if (!address) throw new Error(`${envName} is not set`);
    if (!provider) throw new Error("ARC_RPC_URL is not set");
    const code = await provider.getCode(address);
    if (code === "0x") throw new Error(`no contract at ${address}`);
    return `deployed at ${address}`;
  };

  return Promise.all([
    run("Configuration", true, async () => {
      const missing = REQUIRED_ENV.filter((n) => !process.env[n]);
      const problems = [...missing.map((n) => `${n} is not set`), ...validateNetworkEnv(NETWORK, process.env)];
      if (problems.length) throw new Error(problems.join("; "));
      return `${NETWORK}, all required settings present`;
    }),
    run("Database", true, async () => {
      const { count, error } = await getSupabaseAdmin().from("users").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} users`;
    }),
    run("Database migrations", true, async () => {
      // 008_referrals is the newest migration; its column missing means the schema is behind the code.
      const { error } = await getSupabaseAdmin().from("users").select("referred_by").limit(1);
      if (error) throw new Error(`008_referrals not applied: ${error.message}`);
      return "up to date (008_referrals)";
    }),
    run("Arc RPC", true, async () => {
      if (!provider) throw new Error("ARC_RPC_URL is not set");
      const [chainId, block] = await Promise.all([provider.send("eth_chainId", []), provider.getBlockNumber()]);
      if (Number(chainId) !== ARC_CHAIN_ID) throw new Error(`chain ${Number(chainId)}, expected ${ARC_CHAIN_ID}`);
      return `chain ${ARC_CHAIN_ID}, block ${block}`;
    }),
    run("USDC contract", true, hasCode("ARC_USDC_ADDRESS")),
    run("SplitEscrow contract", true, hasCode("NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT")),
    run("GoalPool contract", true, hasCode("NEXT_PUBLIC_GOAL_POOL_CONTRACT")),
    run("Circle wallets API", true, async () => {
      const res = await fetch("https://api.circle.com/v1/w3s/config/entity/publicKey", {
        headers: { authorization: `Bearer ${process.env.CIRCLE_API_KEY}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Circle answered ${res.status}`);
      return "API key accepted";
    }),
    run("Relayer gas", false, async () => {
      // Only cross-chain (CCTP) payments use the relayer; same-chain payments are signed by the user.
      if (!process.env.RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY is not set (cross-chain payments off)");
      if (!provider) throw new Error("ARC_RPC_URL is not set");
      const address = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address;
      const balance = Number(ethers.formatEther(await provider.getBalance(address)));
      if (balance < 1) throw new Error(`${address} holds ${balance.toFixed(4)} USDC; top it up from the faucet`);
      return `${address} holds ${balance.toFixed(2)} USDC`;
    }),
    run("Cash out", false, async () => {
      if (!process.env.YELLOW_CARD_API_KEY || !process.env.YELLOW_CARD_API_SECRET) throw new Error("Yellow Card keys not set, cash out is off");
      if (!process.env.OFFRAMP_COLLECTION_ADDRESS) throw new Error("OFFRAMP_COLLECTION_ADDRESS not set, cash out is off");
      return process.env.YELLOW_CARD_SANDBOX === "false" ? "live" : "sandbox";
    }),
  ]);

}

export async function GET(req: Request) {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    running ??= runChecks().finally(() => {
      running = null;
    });
    cached = { at: Date.now(), checks: await running };
  }
  const { checks, at } = cached;
  const ok = checks.every((c) => c.ok || !c.critical);
  const headers = { "cache-control": "no-store" };
  const body = detailAllowed(req)
    ? { ok, network: NETWORK, checkedAt: new Date(at).toISOString(), checks }
    : { ok };
  return NextResponse.json(body, { status: ok ? 200 : 503, headers });
}
