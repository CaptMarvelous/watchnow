import Link from "next/link";
import { logout } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import { SITE_NAME, SITE_NAME_PARTS } from "@/lib/site";
import { SearchBox } from "./SearchBox";

const navLink = "text-sm text-mute transition-colors hover:text-cream";

export function Header({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-cream"
          aria-label={`${SITE_NAME} home`}
        >
          {SITE_NAME_PARTS[0]}
          <span className="text-marquee">{SITE_NAME_PARTS[1]}</span>
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-4">
          <Link href="/library" className={navLink}>
            Library
          </Link>
          <Link href="/import" className={navLink}>
            Import
          </Link>
        </nav>

        <div className="order-last w-full sm:order-none sm:ml-auto sm:w-72">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          {user ? (
            <>
              <Link href="/account" className={`${navLink} max-w-32 truncate`} title="Account">
                {user.displayName}
              </Link>
              <form action={logout}>
                <button type="submit" className={navLink}>
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={navLink}>
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-marquee px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-marquee/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
