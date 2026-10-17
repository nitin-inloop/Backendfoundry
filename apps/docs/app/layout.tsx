import "@fontsource-variable/inter";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "../components/site/footer";
import { Navbar } from "../components/site/navbar";
import { THEME_SCRIPT } from "../components/site/theme";

export const metadata: Metadata = {
  title: {
    default: "BackendFoundry — Typed backend components you own",
    template: "%s — BackendFoundry"
  },
  description:
    "Typed, tested TypeScript modules for rate limiting, validation, retries, circuit breakers, caching, idempotency, webhooks, health checks, errors, logging and AI providers. Install the package or copy the source.",
  icons: { icon: "/logo.png", shortcut: "/logo.png", apple: "/logo.png" }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" }
  ],
  colorScheme: "light dark"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script toggles `.dark` on <html> before hydration, so the class can differ from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-primary px-4 py-2 text-body-sm text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
        <Navbar />
        <div id="main" className="flex-1 outline-none" tabIndex={-1}>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
