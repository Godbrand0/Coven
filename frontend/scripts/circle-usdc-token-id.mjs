// Prints the Circle token id(s) for USDC in one user's wallet, for ARC_USDC_TOKEN_ID.
// Read-only: it mints a session token, lists the user's wallets and reads their balances.
//
//   node --env-file=.env.mainnet scripts/circle-usdc-token-id.mjs <user id>
//
// <user id> is the user's UID in Supabase (Authentication → Users). The user must already have
// created their wallet in the app. Use the ERC20 row: Arc also has a native (18-decimal) USDC entry.
const API = "https://api.circle.com/v1/w3s";
const userId = process.argv[2];
if (!userId) throw new Error("usage: node --env-file=.env.mainnet scripts/circle-usdc-token-id.mjs <user id>");
if (!process.env.CIRCLE_API_KEY) throw new Error("CIRCLE_API_KEY is not set (is the env file loaded?)");

async function call(path, { token, ...init } = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      ...(token ? { "X-User-Token": token } : {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${json.message ?? JSON.stringify(json)}`);
  return json.data;
}

const { userToken } = await call("/users/token", { method: "POST", body: JSON.stringify({ userId }) });
const { wallets } = await call("/wallets", { token: userToken });
if (!wallets.length) throw new Error("This user has no wallets yet. Create one in the app first.");

for (const w of wallets) {
  const { tokenBalances } = await call(`/wallets/${w.id}/balances`, { token: userToken });
  for (const b of tokenBalances) {
    if (!b.token.symbol?.startsWith("USDC")) continue;
    console.log(`${w.blockchain}  ${b.token.standard ?? "native"}  decimals=${b.token.decimals}  id=${b.token.id}`);
  }
  if (!tokenBalances.length) console.log(`${w.blockchain}: no token balances yet. Fund the wallet with a few cents of USDC first.`);
}
