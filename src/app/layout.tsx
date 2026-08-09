import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHAMA Squad Manager",
  description: "Gestion de team Warzone, mix, événements, admin et règlement.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CHAMA",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f1e",
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