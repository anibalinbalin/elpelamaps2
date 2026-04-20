import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Inter, Geist_Mono } from "next/font/google";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1016",
};

export const metadata: Metadata = {
  title: {
    default: "Parcel Pin",
    template: "%s | Parcel Pin",
  },
  description:
    "Parcel Pin helps buyers choose premium land with more clarity, confidence, and emotional precision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${baselClassic.variable} ${baselGrotesk.variable} ${inter.variable} ${geistMono.variable}`}
    >
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
