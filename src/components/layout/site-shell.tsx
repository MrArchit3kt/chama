import type { ReactNode } from "react";
import { SiteSidebar } from "@/components/layout/site-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { PresenceHeartbeat } from "@/components/layout/presence-heartbeat";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { ScrollRestoration } from "@/components/layout/scroll-restoration";
import { ChamaWelcomePopup } from "@/components/layout/chama-welcome-popup";
import { ApprovalWelcomePopup } from "@/components/layout/approval-welcome-popup";
import { PushOptInPrompt } from "@/components/notifications/push-opt-in-prompt";
import { SiteThemeOverlay } from "@/components/theme/site-theme-overlay";
import { getSessionUser, getChamaWelcomeState, getApprovalWelcomeState } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { getMixVisibility } from "@/lib/mix-visibility";

type SiteShellProps = {
  children: ReactNode;
};

export async function SiteShell({ children }: SiteShellProps) {
  const [user, showApprovalWelcome, showChamaWelcome, config, mixVisibility] = await Promise.all([
    getSessionUser(),
    getApprovalWelcomeState(),
    getChamaWelcomeState(),
    db.siteConfig.findUnique({
      where: { id: "main" },
      select: { theme: true, discordInviteUrl: true },
    }),
    getMixVisibility(),
  ]);
  const canSeeAdmin =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen px-4 py-6 md:px-6">
      <PresenceHeartbeat />
      <AutoRefresh intervalMs={8000} />
      <ScrollRestoration />
      <SiteThemeOverlay theme={config?.theme ?? "DEFAULT"} />
      {/* Une seule pop-up de célébration à la fois : priorité à celle de
          validation de compte si les deux sont vraies (cas rare). */}
      {showApprovalWelcome ? (
        <ApprovalWelcomePopup discordInviteUrl={config?.discordInviteUrl} />
      ) : showChamaWelcome ? (
        <ChamaWelcomePopup />
      ) : null}

      {user ? <PushOptInPrompt /> : null}

      <div className="mx-auto max-w-7xl">
        <MobileNav canSeeAdmin={canSeeAdmin} isSuperAdmin={isSuperAdmin} mixVisibility={mixVisibility} />

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