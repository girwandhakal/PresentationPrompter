"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { DeliveryFields } from "../../../components/setup/DeliveryFields";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/controls";
import { ThemeToggle } from "../../../components/ui/theme-toggle";
import { useAuth, useTodayUsage } from "@/lib/auth";
import { clampBrief, DEFAULT_BRIEF } from "@/lib/domain/planner";
import { usePref } from "@/lib/prefs";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const [defaults, setDefaults] = usePref("defaultBrief");

  return (
    <div className="page page--narrow settings">
      <h1 className="page-title">Settings</h1>

      <AccountSection />

      <section className="settings__section" aria-labelledby="settings-appearance">
        <div className="settings__theme">
          <h2 id="settings-appearance" className="section-title">Theme</h2>
          <ThemeToggle />
        </div>
      </section>

      <section className="settings__section" aria-labelledby="settings-defaults">
        <h2 id="settings-defaults" className="section-title">Defaults for new presentations</h2>
        <DeliveryFields
          value={defaults}
          onChange={(values) => {
            const next = { ...defaults, ...values };
            const clamped = clampBrief({ ...DEFAULT_BRIEF, ...next });
            setDefaults({ ...next, minutes: clamped.minutes, wpm: clamped.wpm });
          }}
        />
      </section>
    </div>
  );
}

function AccountSection() {
  const { enabled, account, signOut } = useAuth();
  const usage = useTodayUsage(account?.uid ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  if (!enabled || !account) return null;

  const leave = async () => {
    setPending(true);
    setError(false);
    try {
      await signOut();
    } catch {
      setError(true);
      setPending(false);
    }
  };

  return (
    <section className="settings__section" aria-labelledby="settings-account">
      <h2 id="settings-account" className="section-title">Account</h2>
      <div className="settings__account">
        <div className="settings__account-id">
          {account.name && <strong>{account.name}</strong>}
          {account.email && <span>{account.email}</span>}
        </div>
        <Button icon={<LogOut aria-hidden="true" />} loading={pending} onClick={leave}>Sign out</Button>
      </div>
      {usage && (
        <p className="settings__usage">
          AI use today: {usage.generations} {usage.generations === 1 ? "script" : "scripts"} generated,{" "}
          {usage.tokens.toLocaleString()} tokens. Allowances reset at midnight UTC.
        </p>
      )}
      {error && <Callout tone="error">Couldn&apos;t sign out. Try again.</Callout>}
    </section>
  );
}
