import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "El Pela — José Ignacio Real Estate",
  description: "Explore premium land parcels in José Ignacio, Uruguay in immersive 3D.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
