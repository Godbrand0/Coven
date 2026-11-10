import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Short link to the testnet whitepaper (public/coven-testnet-whitepaper.pdf). Temporary, so a new
  // version can take over the same URL.
  async redirects() {
    return [{ source: "/whitepaper", destination: "/coven-testnet-whitepaper.pdf", permanent: false }];
  },
};

export default nextConfig;
