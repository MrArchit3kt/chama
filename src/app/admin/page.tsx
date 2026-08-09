export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Settings,
  CalendarDays,
  Shield,
  Users,
  Share2,
  Mail,
  SlidersHorizontal,
  UserCheck,
  Target,
  Gamepad2,
  Swords,
  Award,
  Headphones,
  Bug,
  Activity,
  Wifi,
  TrendingUp,
} from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";

const cards = [
  {
    href: "/admin/players",
    title: "Joueurs",
    description: "Warnings, bans, activité, suivi des membres.",
    icon: Users,
  },
  {
    href: "/admin/registrations",
    title: "Inscriptions",
    description: "Valider, refuser et suivre les demandes d’inscription.",
    icon: UserCheck,
  },
  {
    href: "/admin/mix/warzone",
    title: "Warzone Mix",
    description: "Pool Warzone, invités, sélection admin générateur, génération équipes.",
    icon: Target,
  },
  {
    href: "/admin/mix/warzone-ranked",
    title: "Warzone Ranked Mix",
    description: "Pool Warzone, invités, sélection admin générateur, génération équipes.",
    icon: Target,
  },
  {
    href: "/admin/mix/bo7",
    title: "BO7 Mix",
    description: "Pool BO7, invités, sélection admin générateur, génération équipes.",
    icon: Swords,
  },
  {
    href: "/admin/mix/rocket-league",
    title: "Rocket League Mix",
    description: "File RL, 2v2 / 3v3, rangs, génération par niveau.",
    icon: Gamepad2,
  },
  {
    href: "/admin/badges",
    title: "Badges",
    description: "Créer des badges et les attribuer aux joueurs.",
    icon: Award,
  },
  {
    href: "/admin/discord",
    title: "Discord",
    description: "Salons vocaux par équipe et déplacement automatique des joueurs.",
    icon: Headphones,
  },
  {
    href: "/admin/events",
    title: "Événements",
    description: "Créer, modifier, illustrer et supprimer les événements.",
    icon: CalendarDays,
  },
  {
    href: "/admin/contact",
    title: "Contact",
    description: "Voir et traiter les demandes, bugs et signalements.",
    icon: Mail,
  },
  {
    href: "/admin/reglement",
    title: "Règlement",
    description: "Écrire et mettre à jour le règlement officiel.",
    icon: Shield,
  },
  {
    href: "/admin/settings",
    title: "Settings",
    description: "Modifier les liens, textes et réglages globaux du site.",
    icon: SlidersHorizontal,
  },
  {
    href: "/socials",
    title: "Réseaux",
    description: "Vérifier les accès Discord / WhatsApp affichés publiquement.",
    icon: Share2,
  },
  {
    href: "/admin/errors",
    title: "Erreurs",
    description: "Historique des erreurs serveur inattendues (monitoring).",
    icon: Bug,
  },
];

function oneDayAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

function mixGameLabel(game: string) {
  switch (game) {
    case "WARZONE":
      return "Warzone";
    case "WARZONE_RANKED":
      return "Ranked";
    case "BO7":
      return "BO7";
    case "ROCKET_LEAGUE":
      return "Rocket League";
    default:
      return game;
  }
}

export default async function AdminHomePage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const [
    activePlayers,
    pendingRegistrations,
    openContactRequests,
    chamaMembers,
    bannedPlayers,
    recentErrors,
    onlineNow,
    mixesThisWeek,
    mixesByGame,
    activePlayerIdsThisWeek,
  ] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE", registrationStatus: "APPROVED" } }),
    db.user.count({ where: { registrationStatus: "PENDING" } }),
    db.contactRequest.count({ where: { status: "OPEN" } }),
    db.user.count({ where: { isChamaMember: true } }),
    db.user.count({ where: { status: "BANNED" } }),
    db.errorLog.count({ where: { createdAt: { gte: oneDayAgo() } } }),
    db.user.count({ where: { isOnline: true, status: "ACTIVE" } }),
    db.mixSession.count({ where: { createdAt: { gte: sevenDaysAgo() } } }),
    db.mixSession.groupBy({
      by: ["game"],
      where: { createdAt: { gte: sevenDaysAgo() } },
      _count: { _all: true },
    }),
    db.mixSessionPlayer.findMany({
      where: { session: { createdAt: { gte: sevenDaysAgo() } }, userId: { not: null } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const participationRate =
    activePlayers > 0
      ? Math.round((activePlayerIdsThisWeek.length / activePlayers) * 100)
      : 0;

  const stats = [
    { href: "/admin/players", label: "Joueurs actifs", value: activePlayers, color: "text-cyan-300" },
    { href: "/admin/registrations", label: "Inscriptions en attente", value: pendingRegistrations, color: "text-amber-300" },
    { href: "/admin/contact", label: "Demandes ouvertes", value: openContactRequests, color: "text-pink-300" },
    { href: "/admin/players", label: "Membres CHAMA", value: chamaMembers, color: "text-emerald-300" },
    { href: "/admin/players", label: "Joueurs bannis", value: bannedPlayers, color: "text-rose-300" },
    { href: "/admin/errors", label: "Erreurs (24h)", value: recentErrors, color: "text-rose-300" },
  ];

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-cyan-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
              Admin
            </p>
          </div>

          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Centre de contrôle du site
          </h1>

          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Gère la communauté CHAMA : joueurs, inscriptions, mix, événements,
            demandes de contact, règlement et configuration globale du site.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="neon-card-soft p-3 transition hover:-translate-y-0.5 md:p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50 md:text-[11px] md:tracking-[0.18em]">
                {stat.label}
              </p>
              <p className={`mt-1 text-xl font-black md:text-2xl ${stat.color}`}>{stat.value}</p>
            </Link>
          ))}
        </div>

        <div className="neon-card p-5 md:p-8">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-cyan-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
              Activité
            </p>
          </div>
          <h2 className="mt-2 text-lg font-bold text-white md:text-xl">
            7 derniers jours
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="neon-card-soft p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Mixes générés
              </p>
              <p className="mt-1 text-2xl font-black text-white">{mixesThisWeek}</p>
            </div>

            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-emerald-300" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  En ligne maintenant
                </p>
              </div>
              <p className="mt-1 text-2xl font-black text-emerald-300">{onlineNow}</p>
            </div>

            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-cyan-300" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  Participation
                </p>
              </div>
              <p className="mt-1 text-2xl font-black text-cyan-300">{participationRate}%</p>
              <p className="neon-text-muted mt-1 text-[11px]">
                {activePlayerIdsThisWeek.length} joueur(s) dans une file sur {activePlayers}
              </p>
            </div>

            <div className="neon-card-soft p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                Par jeu
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mixesByGame.length === 0 ? (
                  <span className="neon-text-muted text-xs">Aucun mix cette semaine</span>
                ) : (
                  mixesByGame.map((g) => (
                    <span key={g.game} className="neon-badge text-[10px]">
                      {mixGameLabel(g.game)} : {g._count._all}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="neon-card p-4 transition hover:-translate-y-0.5 md:p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/6 md:h-11 md:w-11">
                    <Icon className="h-4.5 w-4.5 text-cyan-300 md:h-5 md:w-5" />
                  </div>

                  <h2 className="text-lg font-bold text-white md:text-xl">{card.title}</h2>
                </div>

                <p className="neon-text-muted mt-3 text-sm leading-6 md:mt-4">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </SiteShell>
  );
}