import type { ReactNode } from "react";
import { SiteSidebar } from "@/components/layout/site-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { ScrollRestoration } from "@/components/layout/scroll-restoration";
import { ChamaWelcomePopup } from "@/components/layout/chama-welcome-popup";
import { SiteThemeOverlay } from "@/components/theme/site-theme-overlay";
import { getSessionUser, getChamaWelcomeState } from "@/server/auth/session";
import { db } from "@/lib/prisma";

type SiteShellProps = {
  children: ReactNode;
};

export async function SiteShell({ children }: SiteShellProps) {
  const [user, showChamaWelcome, config] = await Promise.all([
    getSessionUser(),
    getChamaWelcomeState(),
    db.siteConfig.findUnique({ where: { id: "main" }, select: { theme: true } }),
  ]);
  const canSeeAdmin =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <PresenceHeartbeat />
      <AutoRefresh intervalMs={8000} />
      <ScrollRestoration />
      <SiteThemeOverlay theme={config?.theme ?? "DEFAULT"} />
      {showChamaWelcome ? <ChamaWelcomePopup /> : null}

      <div className="mx-auto max-w-7xl">
        <MobileNav canSeeAdmin={canSeeAdmin} />

        <div className="flex gap-6">
          <SiteSidebar />

          <div className="min-w-0 flex-1">
            <SiteHeader />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}