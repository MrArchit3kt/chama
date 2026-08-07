import { ReactNode } from "react";

// Le rafraîchissement automatique est désormais géré globalement par
// <AutoRefresh /> dans SiteShell (voir src/components/layout/site-shell.tsx),
// que chaque page admin utilise déjà.
export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}