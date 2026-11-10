import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/supabase";
import { getCircleUserToken, getUSDCBalance } from "@/lib/circle/wallets";
import { DEFAULT_CURRENCY, getCurrency } from "@/lib/currency";
import { getMarketRate } from "@/lib/server/fx";

/** GET /api/balance?currency=GHS - Circle wallet USDC balance + estimate in the chosen currency. */
export async function GET(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currency =
    getCurrency(new URL(req.url).searchParams.get("currency"))?.code ?? DEFAULT_CURRENCY;

  const [balance, market] = await Promise.all([
    user.circle_wallet_id
      ? getCircleUserToken(user.id).then(({ userToken }) =>
          getUSDCBalance(user.circle_wallet_id!, userToken)
        )
      : Promise.resolve("0"),
    getMarketRate(currency),
  ]);
  const { rate } = market;

  return NextResponse.json({
    usdc: balance,
    localEstimate: parseFloat(balance) * rate,
    localCurrency: currency,
    rate,
    // Mid-market, not a payout quote. `rateStale` means it is not a fresh live rate.
    rateSource: market.source,
    rateAsOf: market.asOf,
    rateStale: market.stale,
    walletAddress: user.wallet_address,
  });
}
