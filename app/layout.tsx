import type { Metadata } from "next";
import { DevTools } from "@/components/dev-tools";
import { DialKitProvider } from "@/components/dialkit-provider";
import { VersionBadge } from "@/components/version-badge";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "José Ignacio Lotes Demo",
    template: "%s | José Ignacio Lotes Demo",
  },
  description: "Explore premium land parcels in José Ignacio, Uruguay in immersive 3D.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <VersionBadge />
        <DialKitProvider />
        {process.env.NODE_ENV === "development" && <DevTools />}
      </body>
    </html>
  );
}
