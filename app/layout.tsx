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
  metadataBase: new URL("https://parcelpin.com"),
  title: {
    default: "Parcel Pin - Masterplan 3D for Land Sales",
    template: "%s | Parcel Pin",
  },
  description:
    "Interactive masterplan and 3D land viewer for loteos, subdivisions, and real estate projects. Buyers explore parcels, sunlight, terrain, and views from one shareable link.",
  keywords: [
    "masterplan 360",
    "masterplan 3D",
    "loteos",
    "recorridos virtuales inmobiliarios",
    "interactive land viewer",
    "subdivision marketing",
    "real estate virtual tour",
    "parcel viewer",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Parcel Pin - Interactive Masterplan for Land Sales",
    description:
      "Turn a subdivision plan into a buyer-ready 3D viewer with real terrain, accurate sun paths, and one link per lot.",
    url: "https://parcelpin.com",
    siteName: "Parcel Pin",
    images: [
      {
        url: "/landing/hero-poster.jpg",
        width: 1200,
        height: 630,
        alt: "Parcel Pin interactive land viewer",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Parcel Pin - Interactive Masterplan for Land Sales",
    description:
      "A 3D masterplan viewer for loteos, subdivisions, and real estate teams.",
    images: ["/landing/hero-poster.jpg"],
  },
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
