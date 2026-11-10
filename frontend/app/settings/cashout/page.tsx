"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Alert, Button, Card, Input, Select, SectionHeading } from "@/components/ui";
import { BanknoteIcon, PlusIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { BankAccount } from "@/lib/types";

export default function CashoutSettingsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [addingBank, setAddingBank] = useState(false);
  const [bankForm, setBankForm] = useState({ bankCode: "", accountNumber: "", accountName: "" });
  const [bankBusy, setBankBusy] = useState(false);
  const [bankError, setBankError] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ accounts: BankAccount[]; banks: { code: string; name: string }[] }>("/api/banks")
      .then(({ accounts, banks }) => {
        setAccounts(accounts);
        setBanks(banks);
      })
      .catch(() => {});
  }, [user]);

  async function addBank() {
    setBankBusy(true);
    setBankError("");
    try {
      const { account } = await api<{ account: BankAccount }>("/api/banks", {
        json: { ...bankForm, country: "NG", currency: "NGN", isDefault: accounts.length === 0 },
      });
      setAccounts((a) => [account, ...a]);
      setAddingBank(false);
      setBankForm({ bankCode: "", accountNumber: "", accountName: "" });
    } catch (e) {
      setBankError(e instanceof Error ? e.message : "Could not save bank");
    } finally {
      setBankBusy(false);
    }
  }

  return (
    <AppShell title="Cash out" subtitle="Bank accounts for payouts" back>
      <div className="mx-auto max-w-xl space-y-5">
          <Card className="space-y-3.5">
            <SectionHeading
              title="Bank accounts"
              count={accounts.length}
              action={
                <button
                  onClick={() => setAddingBank((s) => !s)}
                  className="inline-flex items-center gap-1 rounded text-xs font-bold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {addingBank ? (
                    "Cancel"
                  ) : (
                    <>
                      <PlusIcon className="h-3.5 w-3.5" /> Add
                    </>
                  )}
                </button>
              }
            />

            {accounts.length === 0 && !addingBank && (
              <p className="text-xs leading-relaxed text-ink-soft">
                None saved yet. Add one so you can cash out USDC straight to
                your bank.
              </p>
            )}

            {accounts.length > 0 && (
              <ul className="divide-y divide-line">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
                      <BanknoteIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{a.bank_name}</p>
                      <p className="tnum truncate text-xs text-ink-mute">
                        ···· {a.account_last4} · {a.account_name}
                      </p>
                    </div>
                    {a.is_default && (
                      <span className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-bold text-accent">
                        Default
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {addingBank && (
              <div className="animate-fade-up space-y-3.5 border-t border-line pt-3.5">
                <Select
                  label="Bank"
                  value={bankForm.bankCode}
                  onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
                >
                  <option value="">Select bank</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Account number"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0123456789"
                  value={bankForm.accountNumber}
                  onChange={(e) =>
                    setBankForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))
                  }
                />
                <Input
                  label="Account name"
                  placeholder="As it appears on your bank statement"
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
                />
                {bankError && <Alert>{bankError}</Alert>}
                <Button
                  fullWidth
                  onClick={addBank}
                  loading={bankBusy}
                  disabled={
                    !bankForm.bankCode || !bankForm.accountNumber || !bankForm.accountName
                  }
                >
                  Save bank account
                </Button>
              </div>
            )}
          </Card>
      </div>
    </AppShell>
  );
}
