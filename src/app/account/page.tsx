import type { Metadata } from "next";
import type { ReactNode } from "react";
import { signOutEverywhere, signOutOtherDevices } from "@/app/actions/account";
import {
  DeleteAccountForm,
  EmailForm,
  PasswordForm,
  ProfileForm,
} from "@/components/account/AccountForms";
import { requireUser } from "@/lib/auth/dal";
import { countSessions } from "@/lib/auth/session";
import { libraryStats } from "@/lib/library/queries";

export const metadata: Metadata = { title: "Account" };

function Section({
  title,
  description,
  children,
  danger = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border bg-surface p-5 ${danger ? "border-rose-400/30" : "border-line"}`}
    >
      <h2 className="font-display text-xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-mute">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const outline =
  "rounded-full border border-line px-4 py-2 text-sm text-cream transition-colors hover:border-cream";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const [sessions, stats] = await Promise.all([countSessions(user.id), libraryStats(user.id)]);
  const joined = new Date(user.createdAt).toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl">Account</h1>
        <p className="mt-1 text-sm text-mute">
          {user.displayName} · member since {joined}
        </p>
      </header>

      <Section title="Profile">
        <ProfileForm displayName={user.displayName} />
      </Section>

      <Section title="Email" description="Changing it needs your current password.">
        <EmailForm email={user.email} />
      </Section>

      <Section title="Password" description="Changing it signs you out everywhere else.">
        <PasswordForm />
      </Section>

      <Section
        title="Devices"
        description={`You're signed in on ${sessions} ${sessions === 1 ? "device" : "devices"}.`}
      >
        <div className="flex flex-wrap gap-3">
          <form action={signOutOtherDevices}>
            <button type="submit" disabled={sessions <= 1} className={`${outline} disabled:opacity-50`}>
              Sign out other devices
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button type="submit" className={outline}>
              Sign out everywhere
            </button>
          </form>
        </div>
      </Section>

      <Section
        title="Your data"
        description={`${stats.total} ${stats.total === 1 ? "title" : "titles"} in your library. Download a copy any time.`}
      >
        <div className="flex flex-wrap gap-3">
          <a href="/account/export?format=json" download className={outline}>
            Download JSON
          </a>
          <a href="/account/export?format=csv" download className={outline}>
            Download CSV
          </a>
        </div>
      </Section>

      <Section
        title="Delete account"
        description="Permanently deletes your account and your whole library. This can't be undone."
        danger
      >
        <DeleteAccountForm />
      </Section>
    </div>
  );
}
