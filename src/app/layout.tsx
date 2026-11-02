import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entretiens professionnels – Ville de Saint-Jean-de-la-Ruelle",
  description: "Gestion des entretiens professionnels annuels",
  icons: { icon: "/logo-sjr.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
