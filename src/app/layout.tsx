import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHAMA Squad Manager",
  description: "Gestion de team Warzone, mix, événements, admin et règlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="page-wrap neon-grid">
        <div className="content-layer">{children}</div>
      </body>
    </html>
  );
}