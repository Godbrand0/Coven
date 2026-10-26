// A mainnet deployment must refuse to run on leftover testnet settings (and a testnet one on a live
// Circle key). This checks the validator that guards every chain and Circle call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/fakes.mjs";

const { validateNetworkEnv, assertCrossChainEnabled } = await load("lib/network.ts");

const MAINNET_OK = {
  ARC_RPC_URL: "https://rpc.mainnet.arc.io",
  ARC_CHAIN_ID: "5042",
  ARC_USDC_ADDRESS: "0x3600000000000000000000000000000000000000",
  ARC_USDC_TOKEN_ID: "token-id",
  NEXT_PUBLIC_PAYCIRCLE_CONTRACT: "0x1",
  NEXT_PUBLIC_SPLIT_ESCROW_CONTRACT: "0x2",
  NEXT_PUBLIC_GOAL_POOL_CONTRACT: "0x3",
  CIRCLE_API_KEY: "LIVE_API_KEY:abc:def",
  NEXT_PUBLIC_CIRCLE_APP_ID: "app",
  RELAYER_PRIVATE_KEY: "0xkey",
  CIRCLE_BLOCKCHAIN: "ARC",
};

test("a complete mainnet env passes", () => {
  assert.deepEqual(validateNetworkEnv("mainnet", MAINNET_OK), []);
});

test("mainnet rejects testnet leftovers", () => {
  const bad = (patch) => validateNetworkEnv("mainnet", { ...MAINNET_OK, ...patch }).join(" | ");
  assert.match(bad({ ARC_RPC_URL: "https://rpc.testnet.arc.network" }), /testnet endpoint/);
  assert.match(bad({ ARC_CHAIN_ID: "5042002" }), /ARC_CHAIN_ID must be 5042/);
  assert.match(bad({ CIRCLE_BLOCKCHAIN: "ARC-TESTNET" }), /CIRCLE_BLOCKCHAIN must be ARC/);
  assert.match(bad({ CIRCLE_API_KEY: "TEST_API_KEY:abc:def" }), /test key on a mainnet/);
});

test("mainnet names every missing value", () => {
  const out = validateNetworkEnv("mainnet", {}).join(" | ");
  for (const n of ["ARC_RPC_URL", "ARC_USDC_TOKEN_ID", "NEXT_PUBLIC_GOAL_POOL_CONTRACT", "CIRCLE_API_KEY", "RELAYER_PRIVATE_KEY"]) {
    assert.match(out, new RegExp(`${n} is not set`));
  }
});

test("testnet only refuses a live Circle key", () => {
  assert.deepEqual(validateNetworkEnv("testnet", {}), []);
  assert.deepEqual(validateNetworkEnv("testnet", { CIRCLE_API_KEY: "TEST_API_KEY:a:b" }), []);
  assert.match(validateNetworkEnv("testnet", { CIRCLE_API_KEY: "LIVE_API_KEY:a:b" }).join(), /live \(mainnet\) key/);
});

test("this process defaults to testnet, where cross-chain stays available", () => {
  assert.doesNotThrow(() => assertCrossChainEnabled());
});
