import type { Metadata, Viewport } from "next";
import "./globals.css";
import { db } from "@/lib/prisma";
import { themeDataAttr } from "@/lib/site-theme";

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
  themeColor: "#070604",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ✅ Posé sur <body> (racine réelle) et pas plus bas dans l'arbre : les
  // halos de fond animés (.page-wrap::before/::after, voir globals.css)
  // sont des pseudo-éléments de <body> lui-même — un data-theme posé sur un
  // enfant ne les atteindrait jamais (les variables CSS ne remontent pas).
  //
  // ⚠️ RootLayout entoure TOUTE page, y compris lors du prerendering
  // statique au build (pas de DB connectée à ce moment-là) — un échec ici
  // ferait planter le site entier, pas juste une page. Best-effort avec
  // repli silencieux sur le thème par défaut.
  const theme = await db.siteConfig
    .findUnique({ where: { id: "main" }, select: { theme: true } })
    .then((config) => config?.theme)
    .catch(() => undefined);

  return (
    <html lang="fr">
      <body className="page-wrap neon-grid" data-theme={themeDataAttr(theme)}>
        <div className="content-layer">{children}</div>
      </body>
    </html>
  );
}