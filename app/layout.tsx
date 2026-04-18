import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { DevTools } from "@/components/dev-tools";

import { VersionBadge } from "@/components/version-badge";
import "./globals.css";

const baselClassic = localFont({
  src: "./fonts/Basel-Classic-Bold-Italic.woff2",
  variable: "--font-display",
  weight: "635",
  style: "italic",
  display: "swap",
});

const baselGrotesk = localFont({
  src: "./fonts/Basel-Grotesk-Book.woff2",
  variable: "--font-sans",
  weight: "485",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elpela",
    template: "%s | Elpela",
  },
  description:
    "Elpela helps buyers choose premium land with more clarity, confidence, and emotional precision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${baselClassic.variable} ${baselGrotesk.variable}`}>
      <body className="antialiased">
        {children}

        {process.env.NODE_ENV === "development" && (
          <>
            <VersionBadge />
            <DevTools />
            <Script src="https://ui.sh/ui-picker.js" />
          </>
        )}
      </body>
    </html>
  );
}
