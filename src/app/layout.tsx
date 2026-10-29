import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LibraryProvider } from "@/components/LibraryProvider";
import { getCurrentUser } from "@/lib/auth/dal";
import { libraryIndex } from "@/lib/library/queries";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — movies & dramas, tracked`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const index = user ? await libraryIndex(user.id) : {};

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <LibraryProvider value={{ signedIn: Boolean(user), index }}>
          <Header user={user} />
          <main className="flex-1">{children}</main>
          <Footer />
        </LibraryProvider>
      </body>
    </html>
  );
}
