import Image from "next/image";
import Link from "next/link";
import { Bell, Share2, UserCircle2 } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { LogoutButton } from "@/components/layout/logout-button";

const ACTION_CLASS =
  "relative inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-cyan-400/20 hover:bg-white/[0.05]";

export async function SiteHeader() {
  const user = await getSessionUser();

  let unreadNotificationsCount = 0;
  if (user?.id) {
    unreadNotificationsCount = await db.notification.count({
      where: { userId: user.id, readAt: null },
    });
  }

  return (
    <header className="mb-6">
      <div className="neon-card flex flex-col gap-4 p-4 md:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex items-center gap-4">
          {/* ✅ Logo 3D */}
          <div className="logo-3d logo-3d--auto logo-3d--glow">
            <div className="logo-3d__inner relative h-14 w-14 overflow-hidden rounded-2xl border border-cyan-400/20 bg-black/30">
              <Image
                src="/images/CHAMA-logo.jpg"
                alt="Logo CHAMA"
                fill
                sizes="56px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="neon-title neon-gradient-text text-xl font-black md:text-2xl">
              Plateforme de gestion Gaming
            </h1>
            <p className="neon-text-muted mt-1 truncate text-xs md:text-sm">
              Team privée • mix • modération • événements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Link href="/socials" className={ACTION_CLASS}>
            <Share2 className="h-4 w-4 text-cyan-300" />
            <span>Réseaux</span>
          </Link>

          <Link href="/notifications" className={ACTION_CLASS}>
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
              <Link
                href="/profil"
                className="inline-flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 transition hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {user.name}
                  </p>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-300/80">
                    {user.role}
                  </p>
                </div>
              </Link>

              <LogoutButton className={ACTION_CLASS} />
            </>
          ) : (
            <Link href="/login" className={ACTION_CLASS}>
              <UserCircle2 className="h-4 w-4" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}