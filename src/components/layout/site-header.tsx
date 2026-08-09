import Link from "next/link";
import { Bell, Share2, UserCircle2, HelpCircle, Users, Shield, Mail } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { LogoutButton } from "@/components/layout/logout-button";

const ACTION_CLASS =
  "relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-sm font-medium text-white transition hover:border-cyan-400/20 hover:bg-white/[0.05] md:h-11 md:px-4";

export async function SiteHeader() {
  const [user, config] = await Promise.all([
    getSessionUser(),
    db.siteConfig.findUnique({
      where: { id: "main" },
      select: { socialsEnabled: true, contactEnabled: true },
    }),
  ]);

  const socialsEnabled = config?.socialsEnabled ?? true;
  const contactEnabled = config?.contactEnabled ?? true;

  let unreadNotificationsCount = 0;
  if (user?.id) {
    unreadNotificationsCount = await db.notification.count({
      where: { userId: user.id, readAt: null },
    });
  }

  return (
    <header className="mb-6">
      <nav className="neon-card thin-scrollbar flex items-center gap-2 overflow-x-auto p-3 md:p-3.5">
        <Link href="/tuto" className={ACTION_CLASS}>
          <HelpCircle className="h-4 w-4 text-cyan-300" />
          <span>Comment ça marche ?</span>
        </Link>

        <Link href="/membres" className={ACTION_CLASS}>
          <Users className="h-4 w-4 text-cyan-300" />
          <span>Membres</span>
        </Link>

        <Link href="/reglement" className={ACTION_CLASS}>
          <Shield className="h-4 w-4 text-cyan-300" />
          <span>Règlement</span>
        </Link>

        {socialsEnabled ? (
          <Link href="/socials" className={ACTION_CLASS}>
            <Share2 className="h-4 w-4 text-cyan-300" />
            <span>Réseaux</span>
          </Link>
        ) : null}

        {contactEnabled ? (
          <Link href="/contact" className={ACTION_CLASS}>
            <Mail className="h-4 w-4 text-cyan-300" />
            <span>Contact</span>
          </Link>
        ) : null}

        <span className="mx-1 hidden h-7 w-px shrink-0 bg-white/10 lg:block" />

        <Link href="/notifications" className={`${ACTION_CLASS} ml-auto`}>
          <Bell className="h-4 w-4 text-pink-300" />
          <span>Alertes</span>

          {unreadNotificationsCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-pink-400/20 bg-pink-400/90 px-1 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(236,72,153,0.55)]">
              {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
            </span>
          ) : null}
        </Link>

        {user ? (
          <>
            <Link href="/profil" className={ACTION_CLASS}>
              <UserCircle2 className="h-4 w-4 text-cyan-300" />
              <span>{user.name}</span>
            </Link>

            <LogoutButton className={ACTION_CLASS} />
          </>
        ) : (
          <Link href="/login" className={ACTION_CLASS}>
            <UserCircle2 className="h-4 w-4" />
            <span>Connexion</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
