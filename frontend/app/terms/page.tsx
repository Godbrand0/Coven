import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CovenMark } from "@/components/Icons";
import { TELEGRAM_URL } from "@/lib/community";

export const metadata: Metadata = {
  title: "Terms and privacy · Coven",
  description: "How Coven works, what you agree to when you use it, and what we keep about you.",
};

// Plain-language terms and privacy summary. Keep it in step with what the app really does: when a
// feature, a provider or the data we store changes, change this page too.
const VERSION = "0.1 (draft, pending review)";
const UPDATED = "10 November 2026";

function Sec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold tracking-tight text-ink">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <div className="flex-1 bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-70">
            <CovenMark className="h-7 w-7 text-accent" />
            <span className="text-lg font-extrabold tracking-tight">Coven</span>
          </Link>
          <Link href="/signup" className="rounded-lg bg-ink px-3.5 py-2 text-sm font-bold text-surface hover:bg-ink-2">
            Open the app
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-9 px-5 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Terms and privacy</h1>
          <p className="text-sm text-ink-mute">
            Version {VERSION} · Last updated {UPDATED}
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            This is the short version in plain language. By using Coven you agree to it. If you do not agree, please
            do not use Coven.
          </p>
        </div>

        <Sec n={1} title="What Coven is">
          <p>
            Coven is software for sending, receiving, splitting and saving USDC with other people on the Arc network,
            using an @username instead of a long wallet address. Coven is not a bank, and a Coven account is not a bank
            account.
          </p>
          <p>
            Your USDC sits in a wallet that is set up for you, and payments from it need your PIN. Some features, such as
            bill splits and savings goals, lock USDC in a smart contract until that feature&apos;s rules are met. The rules
            are shown before you confirm.
          </p>
        </Sec>

        <Sec n={2} title="Mainnet and testnet">
          <p>
            Coven runs on two networks. On <strong className="text-ink">Arc Mainnet</strong> USDC is real money. On{" "}
            <strong className="text-ink">Arc Testnet</strong> it is free test money with no value. The network you are on
            is shown in Settings.
          </p>
          <p>
            The testnet is for trying things out. It can be reset, changed or switched off at any time, and accounts,
            balances and history on it can be lost.
          </p>
        </Sec>

        <Sec n={3} title="Your account">
          <Bullets
            items={[
              "You sign in with Google and choose an @username. You must be old enough to agree to these terms where you live.",
              "You are responsible for your Google account, your device and your PIN.",
              "Coven will never ask for your PIN, a one-time code or a seed phrase. Anyone who does is not Coven.",
              "Keep your details accurate, and do not use someone else's account.",
            ]}
          />
        </Sec>

        <Sec n={4} title="Payments are final">
          <p>
            A payment on Arc cannot be reversed by Coven or by anyone else. Check the @username and the amount before you
            confirm. If you send money to the wrong person, we cannot get it back.
          </p>
        </Sec>

        <Sec n={5} title="Fees">
          <p>
            Arc charges a small network fee, paid in USDC (about a cent). Coven may add a service fee to some payments.
            You see any fee before you confirm.
          </p>
        </Sec>

        <Sec n={6} title="Cash out">
          <p>
            Cash out to a bank goes through a partner company, Yellow Card. It is not available to everyone yet, and where
            it is, the partner&apos;s rates, limits, checks and delays apply. We do not promise that cash out will be
            available in your country or at any given time.
          </p>
        </Sec>

        <Sec n={7} title="What you must not do">
          <Bullets
            items={[
              "Break the law, including through fraud, money laundering or evading sanctions.",
              "Harass or deceive other people, or pretend to be someone else.",
              "Attack, overload or try to get around the security of Coven, its contracts or its partners.",
              "Create fake or duplicate accounts to collect testnet rewards or inflate activity.",
            ]}
          />
          <p>
            We can limit, suspend or close access to the app for anyone who does. We cannot move money out of your wallet,
            but we can stop the app from working for you.
          </p>
        </Sec>

        <Sec n={8} title="Privacy: what we keep">
          <p>To run Coven we keep:</p>
          <Bullets
            items={[
              "From Google sign-in: your email, name and profile picture.",
              "Your @username, display name and, if you add one, your phone number.",
              "Your wallet address and wallet ID.",
              "Payment records: who paid whom, the amount, the time, the transaction hash and any note.",
              "For cash out: the bank name, the account name and the last four digits of the account number. The full number is encrypted.",
              "Who invited you, if you joined through an invite link.",
            ]}
          />
          <p>
            <strong className="text-ink">Who can see it.</strong> Your @username, display name and picture are visible to
            people who find or pay you. Blockchain transactions are public by design: anyone can see wallet addresses,
            amounts and counterparties on the explorer. On the testnet, a public tracker lists testers&apos; usernames,
            wallet addresses and activity. That tracker does not exist on mainnet. We never publish your email or phone
            number.
          </p>
          <p>
            <strong className="text-ink">Who helps us run it.</strong> Google (sign-in), Circle (wallets), Supabase
            (database), Vercel (hosting) and Yellow Card (cash out, only if you use it). We do not sell your personal data.
          </p>
          <p>
            Want your personal data reviewed or removed? Message us on{" "}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
              Telegram
            </a>
            . Records already on the blockchain cannot be erased by anyone.
          </p>
        </Sec>

        <Sec n={9} title="Risks and no guarantees">
          <p>
            Coven is provided as it is. Crypto carries risk: values and networks change, and software can have bugs. Coven&apos;s
            smart contracts cannot be changed once deployed and have not had an independent security audit. Only use
            amounts you can afford to lose.
          </p>
          <p>
            To the extent the law allows, Coven and the people who build it are not liable for losses that come from
            sending to the wrong person, losing your PIN or device, network or partner outages, or bugs.
          </p>
        </Sec>

        <Sec n={10} title="Changes and contact">
          <p>
            We may update these terms as Coven changes. The date above shows the latest version, and continuing to use
            Coven after a change means you accept it. Questions or problems: our{" "}
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
              Telegram group
            </a>{" "}
            is the fastest way to reach us.
          </p>
        </Sec>
      </main>
    </div>
  );
}
