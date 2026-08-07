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
];

export default async function AdminHomePage() {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const [activePlayers, pendingRegistrations, openContactRequests, chamaMembers, bannedPlayers] =
    await Promise.all([
      db.user.count({ where: { status: "ACTIVE", registrationStatus: "APPROVED" } }),
      db.user.count({ where: { registrationStatus: "PENDING" } }),
      db.contactRequest.count({ where: { status: "OPEN" } }),
      db.user.count({ where: { isChamaMember: true } }),
      db.user.count({ where: { status: "BANNED" } }),
    ]);

  const stats = [
    { href: "/admin/players", label: "Joueurs actifs", value: activePlayers, color: "text-cyan-300" },
    { href: "/admin/registrations", label: "Inscriptions en attente", value: pendingRegistrations, color: "text-amber-300" },
    { href: "/admin/contact", label: "Demandes ouvertes", value: openContactRequests, color: "text-pink-300" },
    { href: "/admin/players", label: "Membres CHAMA", value: chamaMembers, color: "text-emerald-300" },
    { href: "/admin/players", label: "Joueurs bannis", value: bannedPlayers, color: "text-rose-300" },
  ];

  return (
    <SiteShell>
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-cyan-300" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
              Admin
            </p>
          </div>

          <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Centre de contrôle du site
          </h1>

          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Gère la communauté CHAMA : joueurs, inscriptions, mix, événements,
            demandes de contact, règlement et configuration globale du site.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="neon-card-soft p-4 transition hover:-translate-y-0.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {stat.label}
              </p>
              <p className={`mt-1 text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="neon-card p-6 transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06]">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>

                  <h2 className="text-xl font-bold text-white">{card.title}</h2>
                </div>

                <p className="neon-text-muted mt-4 text-sm leading-6">
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