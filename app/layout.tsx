import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import { DevTools } from "@/components/dev-tools";


import { VersionBadge } from "@/components/version-badge";
import "./globals.css";

const jobyDisplay = localFont({
  src: "./fonts/JobySans_Display_Variable-s.p.0q3~mkk0o.mlr.woff2",
  variable: "--font-display",
  display: "swap",
});

const jobyText = localFont({
  src: "./fonts/JobySans_Text_Variable-s.p.109vigqo~-38m.woff2",
  variable: "--font-text",
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
  themeColor: "#f5f4df",
};

export const metadata: Metadata = {
  title: {
    default: "Parcel Pin",
    template: "%s | Parcel Pin",
  },
  description:
    "Interactive 3D land viewer with real terrain, accurate sunlight, and atmospheric detail. Buyers explore independently.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jobyDisplay.variable} ${jobyText.variable} ${geistMono.variable}`}
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
