export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiDiscord } from "react-icons/si";
import { AlertTriangle, UserPlus, LogOut } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

export default async function SocialsPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const config = await db.siteConfig.findUnique({
    where: { id: "main" },
    select: {
      siteName: true,
      discordInviteUrl: true,
      socialsEnabled: true,
    },
  });

  const siteName = config?.siteName ?? "CHAMA Squad Manager";
  const discordInviteUrl = config?.discordInviteUrl?.trim() ?? "";
  const socialsEnabled = config?.socialsEnabled ?? true;

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        {/* HERO IMAGE */}
        <div className="neon-card relative h-32 overflow-hidden p-0 sm:h-44 md:h-56">
          <Image
            src="/images/CHAMA-hero1.jpg"
            alt={siteName}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </div>

        <div className="neon-card p-5 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75 md:text-sm">
            Réseaux de la team
          </p>
          <h1 className="neon-title neon-gradient-text mt-2 text-xl font-black md:mt-3 md:text-3xl">
            Rejoins la communauté {siteName.replace(" Squad Manager", "")}
          </h1>
          <p className="neon-text-muted mt-2 hidden max-w-3xl leading-7 md:mt-4 md:block md:text-base">
            Retrouve les accès principaux de la team pour échanger, organiser les
            sessions et suivre la communauté.
          </p>
        </div>

        {!socialsEnabled ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Les réseaux sont temporairement désactivés par l’administration.
            </p>
          </div>
        ) : (
          <div className="neon-card p-4 md:p-7">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10 md:h-16 md:w-16 md:rounded-3xl">
                <SiDiscord className="h-5 w-5 text-indigo-300 md:h-8 md:w-8" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-300/80 md:text-sm">
                  Discord
                </p>
                <h2 className="truncate text-base font-bold text-white md:mt-1 md:text-2xl">
                  Serveur principal
                </h2>
              </div>

              {discordInviteUrl ? (
                <Link
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="neon-button shrink-0 px-4 py-2.5 text-sm md:hidden"
                >
                  Rejoindre
                </Link>
              ) : null}
            </div>

            <p className="neon-text-muted mt-4 hidden text-sm leading-7 md:block">
              Rejoins le Discord de la team pour les vocales, l’organisation des
              games, les annonces et les échanges rapides.
            </p>

            <div className="mt-6 hidden md:block">
              {discordInviteUrl ? (
                <Link
                  href={discordInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="neon-button inline-flex px-6 py-3"
                >
                  Rejoindre Discord
                </Link>
              ) : (
                <span className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-white/70">
                  Lien Discord non configuré
                </span>
              )}
            </div>

            {!discordInviteUrl ? (
              <span className="mt-3 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/70 md:hidden">
                Lien non configuré
              </span>
            ) : null}
          </div>
        )}

        {/* ASSISTANCE / DEMANDES */}
        <div className="neon-card p-5 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75 md:text-sm">
            Assistance
          </p>
          <h2 className="mt-2 text-lg font-bold text-white md:mt-3 md:text-2xl">
            Une demande à faire ?
          </h2>
          <p className="neon-text-muted mt-2 hidden text-sm leading-6 md:block">
            Signale un problème, fais une demande de recrutement ou informe les
            admins que tu veux quitter la team — tout part directement dans leur
            boîte de demandes.
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3 md:mt-6 md:gap-3">
            <Link
              href="/contact?type=PLAYER_REPORT"
              className="neon-card-soft flex items-center gap-3 p-3.5 transition hover:border-rose-400/20 md:flex-col md:items-start md:gap-2 md:p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10">
                <AlertTriangle className="h-4 w-4 text-rose-300" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  Signaler un problème
                </span>
                <span className="neon-text-muted mt-0.5 hidden text-xs leading-5 md:block">
                  Joueur, logs, Discord…
                </span>
              </span>
            </Link>

            <Link
              href="/contact?type=RECRUITMENT"
              className="neon-card-soft flex items-center gap-3 p-3.5 transition hover:border-emerald-400/20 md:flex-col md:items-start md:gap-2 md:p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10">
                <UserPlus className="h-4 w-4 text-emerald-300" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  Demande de recrutement
                </span>
                <span className="neon-text-muted mt-0.5 hidden text-xs leading-5 md:block">
                  Rejoindre la team CHAMA
                </span>
              </span>
            </Link>

            <Link
              href="/contact?type=LEAVE_TEAM"
              className="neon-card-soft flex items-center gap-3 p-3.5 transition hover:border-amber-400/20 md:flex-col md:items-start md:gap-2 md:p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                <LogOut className="h-4 w-4 text-amber-300" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">
                  Quitter la team
                </span>
                <span className="neon-text-muted mt-0.5 hidden text-xs leading-5 md:block">
                  Prévenir les admins
                </span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
