export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { addWarning } from "@/server/admin/add-warning";
import { revokeWarning } from "@/server/admin/revoke-warning";
import { liftBan } from "@/server/admin/lift-ban";
import { resetPlayerPassword } from "@/server/admin/reset-player-password";
import { toggleChamaMember } from "@/server/admin/toggle-chama-member";
import { toggleAuraMember } from "@/server/admin/toggle-aura-member";
import { toggleUserRole } from "@/server/admin/toggle-user-role";
import { banPlayer } from "@/server/admin/ban-player";
import { awardBadge } from "@/server/admin/award-badge";
import { revokeBadge } from "@/server/admin/revoke-badge";
import { AdminPlayersRealtime } from "@/components/admin/admin-players-realtime";
import { getBadgeIcon, getBadgeColorClasses } from "@/lib/badges";

function formatDate(value: Date | null) {
  if (!value) return "Jamais";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getInactiveDays(lastSeenAt: Date | null) {
  if (!lastSeenAt) return null;

  const now = Date.now();
  const diff = now - new Date(lastSeenAt).getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    case "validation":
      return "Requête invalide.";
    case "password_validation":
      return "Le nouveau mot de passe est invalide (minimum 8 caractères).";
    case "player_not_found":
      return "Joueur introuvable.";
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "self_role":
      return "Tu ne peux pas modifier ton propre rôle.";
    case "super_admin_locked":
      return "Le rôle d’un super admin ne peut pas être modifié ici.";
    case "self_ban":
      return "Tu ne peux pas te bannir toi-même.";
    case "already_banned":
      return "Ce joueur est déjà banni.";
    default:
      return null;
  }
}

function getWarningTypeLabel(type: string) {
  switch (type) {
    case "TOXICITY":
      return "Toxicité";
    case "ABSENCE":
      return "Absence";
    case "AFK":
      return "AFK";
    case "INSULT":
      return "Insulte";
    case "CHEATING_SUSPECT":
      return "Suspicion de cheat";
    case "TEAM_REFUSAL":
      return "Refus d’équipe";
    case "SPAM":
      return "Spam";
    case "OTHER":
      return "Autre";
    default:
      return type;
  }
}

function getRoleLabel(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "PLAYER":
      return "Player";
    default:
      return role;
  }
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300";
    case "ADMIN":
      return "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300";
    case "PLAYER":
      return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/75";
    default:
      return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/75";
  }
}

function getStatusBadgeClass(status: string) {
  if (status === "BANNED") {
    return "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300";
  }

  if (status === "ACTIVE") {
    return "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300";
  }

  return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/75";
}

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    warned?: string;
    banned?: string;
    revoked?: string;
    unbanned?: string;
    password_reset?: string;
    chama?: string;
    aura?: string;
    role_updated?: string;
    manual_banned?: string;
    badge_awarded?: string;
    badge_revoked?: string;
    q?: string;
    role?: string;
    status?: string;
  }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isWarned = sp.warned === "1";
  const isBanned = sp.banned === "1";
  const isRevoked = sp.revoked === "1";
  const isUnbanned = sp.unbanned === "1";
  const isPasswordReset = sp.password_reset === "1";
  const isChamaEnabled = sp.chama === "1";
  const isChamaDisabled = sp.chama === "0";
  const isAuraEnabled = sp.aura === "1";
  const isAuraDisabled = sp.aura === "0";
  const isRoleUpdated = sp.role_updated === "1";
  const isManuallyBanned = sp.manual_banned === "1";
  const isBadgeAwarded = sp.badge_awarded === "1";
  const isBadgeRevoked = sp.badge_revoked === "1";

  const searchQuery = (sp.q ?? "").trim();
  const roleFilter = (sp.role ?? "").trim();
  const statusFilter = (sp.status ?? "").trim();

  const players = await db.user.findMany({
    where: {
      ...(searchQuery
        ? {
            OR: [
              {
                displayName: {
                  contains: searchQuery,
                  mode: "insensitive",
                },
              },
              {
                username: {
                  contains: searchQuery,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: searchQuery,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
      ...(roleFilter && ["PLAYER", "ADMIN", "SUPER_ADMIN"].includes(roleFilter)
        ? { role: roleFilter as "PLAYER" | "ADMIN" | "SUPER_ADMIN" }
        : {}),
      ...(statusFilter && ["ACTIVE", "INACTIVE", "BANNED"].includes(statusFilter)
        ? { status: statusFilter as "ACTIVE" | "INACTIVE" | "BANNED" }
        : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastSeenAt: true,
      isChamaMember: true,
      isAuraMember: true,
      badges: {
        select: {
          badgeId: true,
          badge: { select: { id: true, name: true, icon: true, color: true } },
        },
      },
      warningsReceived: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          type: true,
          message: true,
          status: true,
          createdAt: true,
          revokedAt: true,
          revokedReason: true,
        },
      },
      roleChangesReceived: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          previousRole: true,
          nextRole: true,
          createdAt: true,
          adminUser: {
            select: {
              id: true,
              displayName: true,
              username: true,
            },
          },
        },
      },
    },
  });

  const rows = players.map((player) => {
    const inactiveDays = getInactiveDays(player.lastSeenAt);
    const totalWarnings = player.warningsReceived.length;
    const activeWarnings = player.warningsReceived.filter(
      (warning) => warning.status === "ACTIVE",
    ).length;

    const shouldAlert =
      inactiveDays !== null && inactiveDays >= 10 && player.status === "ACTIVE";

    return {
      id: player.id,
      displayName: player.displayName,
      username: player.username,
      email: player.email,
      role: player.role,
      status: player.status,
      createdAt: player.createdAt,
      lastSeenAt: player.lastSeenAt,
      isChamaMember: player.isChamaMember,
      isAuraMember: player.isAuraMember,
      badges: player.badges,

      inactiveDays,
      totalWarnings,
      activeWarnings,
      shouldAlert,
      warnings: player.warningsReceived,
      roleHistory: player.roleChangesReceived,
    };
  });

  const alertCount = rows.filter((row) => row.shouldAlert).length;
  const chamaCount = rows.filter((row) => row.isChamaMember).length;
  const auraCount = rows.filter((row) => row.isAuraMember).length;

  const badgeCatalog = await db.badge.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <SiteShell>
      <AdminPlayersRealtime channel="players" />

      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-3.5 md:p-8">
          <div className="flex flex-col gap-3 md:gap-6">
            <div className="flex flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/75 md:text-sm">
                  Admin Players
                </p>
                <h2 className="neon-title neon-gradient-text mt-1 text-lg font-black md:mt-3 md:text-3xl">
                  Suivi des joueurs
                </h2>
                <p className="neon-text-muted mt-1 hidden max-w-3xl leading-7 md:mt-4 md:block">
                  Vue admin de l’activité, de l’inactivité, des membres CHAMA et de
                  la modération des joueurs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
                <div className="neon-card-soft px-2 py-1.5 md:px-4 md:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-cyan-300/75 md:text-xs md:tracking-[0.18em]">
                    Total
                  </p>
                  <p className="neon-title neon-gradient-text mt-0.5 text-base font-black md:mt-1 md:text-2xl">
                    {rows.length}
                  </p>
                </div>

                <div className="neon-card-soft px-2 py-1.5 md:px-4 md:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-300/75 md:text-xs md:tracking-[0.18em]">
                    CHAMA
                  </p>
                  <p className="mt-0.5 text-base font-black text-white md:mt-1 md:text-2xl">
                    {chamaCount}
                  </p>
                </div>

                <div className="neon-card-soft px-2 py-1.5 md:px-4 md:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fuchsia-300/75 md:text-xs md:tracking-[0.18em]">
                    AURA
                  </p>
                  <p className="mt-0.5 text-base font-black text-white md:mt-1 md:text-2xl">
                    {auraCount}
                  </p>
                </div>

                <div className="neon-card-soft px-2 py-1.5 md:px-4 md:py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-pink-300/75 md:text-xs md:tracking-[0.18em]">
                    Alertes
                  </p>
                  <p className="mt-0.5 text-base font-black text-white md:mt-1 md:text-2xl">
                    {alertCount}
                  </p>
                </div>
              </div>
            </div>

            <form
              method="GET"
              className="grid gap-2 md:gap-3 md:grid-cols-[1.6fr_1fr_1fr_auto]"
            >
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Rechercher un joueur (nom, pseudo, email)"
                className="w-full px-3 py-2 text-sm md:px-4 md:py-3 md:text-base"
              />

              <div className="grid grid-cols-2 gap-2 md:contents">
                <select
                  name="role"
                  defaultValue={roleFilter}
                  className="w-full px-3 py-2 text-sm md:px-4 md:py-3 md:text-base"
                >
                  <option value="">Tous les rôles</option>
                  <option value="PLAYER">Player</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>

                <select
                  name="status"
                  defaultValue={statusFilter}
                  className="w-full px-3 py-2 text-sm md:px-4 md:py-3 md:text-base"
                >
                  <option value="">Tous les statuts</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
              </div>

              <div className="flex gap-2 md:gap-3">
                <button type="submit" className="neon-button px-5 py-2.5 text-sm md:py-3 md:text-base">
                  Rechercher
                </button>

                <a
                  href="/admin/players"
                  className="neon-button-secondary inline-flex items-center justify-center px-5 py-2.5 text-sm md:py-3 md:text-base"
                >
                  Reset
                </a>
              </div>
            </form>
          </div>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isWarned ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Avertissement ajouté avec succès.
            </p>
          </div>
        ) : null}

        {isBanned ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">
              Le joueur a atteint 5 avertissements actifs du même type et a été
              banni automatiquement.
            </p>
          </div>
        ) : null}

        {isRevoked ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Avertissement révoqué avec succès.
            </p>
          </div>
        ) : null}

        {isUnbanned ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Joueur débanni avec succès.
            </p>
          </div>
        ) : null}

        {isPasswordReset ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-cyan-300">
              Mot de passe du joueur mis à jour avec succès.
            </p>
          </div>
        ) : null}

        {isChamaEnabled ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Membre CHAMA activé avec succès.
            </p>
          </div>
        ) : null}

        {isChamaDisabled ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Membre CHAMA désactivé avec succès.
            </p>
          </div>
        ) : null}

        {isAuraEnabled ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-fuchsia-300">
              Membre AURA activé avec succès.
            </p>
          </div>
        ) : null}

        {isAuraDisabled ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Membre AURA désactivé avec succès.
            </p>
          </div>
        ) : null}

        {isRoleUpdated ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-cyan-300">
              Rôle du joueur mis à jour avec succès.
            </p>
          </div>
        ) : null}

        {isManuallyBanned ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">
              Joueur banni avec succès.
            </p>
          </div>
        ) : null}

        {isBadgeAwarded ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Badge attribué avec succès.
            </p>
          </div>
        ) : null}

        {isBadgeRevoked ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Badge retiré avec succès.
            </p>
          </div>
        ) : null}

        {alertCount > 0 ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Attention : {alertCount} joueur{alertCount > 1 ? "s" : ""} n’a /
              n’ont pas été vu{alertCount > 1 ? "s" : ""} depuis au moins 10 jours.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4">
          {rows.map((player) => (
            <details key={player.id} className="group neon-card relative overflow-hidden p-0">
              <span className="pointer-events-none absolute right-3 top-3 text-xs text-white/40 transition-transform duration-200 group-open:rotate-180 md:hidden">
                ▼
              </span>

              <summary className="list-none cursor-pointer p-2.5 pr-8 md:p-5">
                <div className="flex flex-col gap-1 md:gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1 md:gap-2">
                      <h3 className="truncate text-[13px] font-bold text-white md:text-lg">
                        {player.displayName}
                      </h3>

                      <span className="neon-badge px-1.5 py-0.5 text-[9px] md:px-3 md:py-1 md:text-xs">
                        @{player.username}
                      </span>

                      <span className={`${getRoleBadgeClass(player.role)} px-1.5 py-0.5 text-[8px] md:px-3 md:py-1 md:text-xs`}>
                        {getRoleLabel(player.role)}
                      </span>

                      <span className={`${getStatusBadgeClass(player.status)} px-1.5 py-0.5 text-[8px] md:px-3 md:py-1 md:text-xs`}>
                        {player.status}
                      </span>

                      <span
                        className={
                          (player.isChamaMember
                            ? "rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"
                            : "rounded-full border border-white/10 bg-white/[0.04] text-white/70") +
                          " px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] md:px-3 md:py-1 md:text-[11px] md:tracking-[0.18em]"
                        }
                      >
                        {player.isChamaMember ? "Membre CHAMA" : "Externe"}
                      </span>

                      {player.isAuraMember ? (
                        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-fuchsia-300 md:px-3 md:py-1 md:text-[11px] md:tracking-[0.18em]">
                          Membre AURA
                        </span>
                      ) : null}

                      {player.shouldAlert ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-amber-300 md:px-3 md:py-1 md:text-[11px] md:tracking-[0.18em]">
                          Inactif 10j+
                        </span>
                      ) : null}
                    </div>

                    <p className="neon-text-muted mt-2 hidden truncate text-sm md:block">
                      {player.email}
                    </p>

                    {/* Résumé compact, mobile uniquement */}
                    <p className="neon-text-muted mt-1 truncate text-[10px] md:hidden">
                      {player.email} · {formatDate(player.lastSeenAt)} ·{" "}
                      {player.inactiveDays === null
                        ? "jamais vu"
                        : `${player.inactiveDays}j inactif`}{" "}
                      · warn {player.activeWarnings}/{player.totalWarnings}
                    </p>
                  </div>

                  <div className="hidden flex-wrap items-center gap-2 xl:justify-end md:flex">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
                        Dernière co
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white">
                        {formatDate(player.lastSeenAt)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                        Inactivité
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white">
                        {player.inactiveDays === null
                          ? "Jamais vu"
                          : `${player.inactiveDays} jour${player.inactiveDays > 1 ? "s" : ""}`}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Warnings
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white">
                        {player.activeWarnings} / {player.totalWarnings}
                      </p>
                    </div>

                    <div className="flex min-w-[110px] items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                          Détails
                        </p>
                        <p className="mt-1 text-xs font-semibold text-white">
                          Ouvrir
                        </p>
                      </div>

                      <span className="text-sm text-white/70 transition-transform duration-200 group-open:rotate-180">
                        ▼
                      </span>
                    </div>
                  </div>
                </div>
              </summary>

              <div className="border-t border-white/8 px-2.5 pb-2.5 pt-2.5 md:px-4 md:pb-4 md:pt-4">
                <div className="grid gap-1.5 md:gap-3">
                  <div className="grid gap-1.5 md:gap-3 xl:grid-cols-4">
                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-2.5 md:p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Statut team CHAMA
                      </p>

                      <p className="neon-text-muted mt-1 md:mt-1.5 text-sm leading-6">
                        Ce joueur est actuellement{" "}
                        <span className="font-semibold text-white">
                          {player.isChamaMember ? "dans la team CHAMA" : "hors team CHAMA"}
                        </span>
                        .
                      </p>

                      <form action={toggleChamaMember} className="mt-1.5 md:mt-2">
                        <input type="hidden" name="userId" value={player.id} />
                        <input
                          type="hidden"
                          name="nextValue"
                          value={player.isChamaMember ? "false" : "true"}
                        />

                        <button
                          type="submit"
                          className={`w-full px-5 py-2 md:py-2.5 ${
                            player.isChamaMember ? "neon-button-secondary" : "neon-button"
                          }`}
                        >
                          {player.isChamaMember ? "Retirer de la team" : "Activer membre CHAMA"}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-fuchsia-400/10 bg-fuchsia-400/[0.03] p-2.5 md:p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300/75">
                        Statut team AURA
                      </p>

                      <p className="neon-text-muted mt-1 md:mt-1.5 text-sm leading-6">
                        Ce joueur est actuellement{" "}
                        <span className="font-semibold text-white">
                          {player.isAuraMember ? "dans la team AURA" : "hors team AURA"}
                        </span>
                        .
                      </p>

                      <form action={toggleAuraMember} className="mt-1.5 md:mt-2">
                        <input type="hidden" name="userId" value={player.id} />
                        <input
                          type="hidden"
                          name="nextValue"
                          value={player.isAuraMember ? "false" : "true"}
                        />

                        <button
                          type="submit"
                          className={`w-full px-5 py-2 md:py-2.5 ${
                            player.isAuraMember ? "neon-button-secondary" : "neon-button"
                          }`}
                        >
                          {player.isAuraMember ? "Retirer de la team" : "Activer membre AURA"}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-2.5 md:p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Rôle du joueur
                      </p>

                      <p className="neon-text-muted mt-1 md:mt-1.5 text-sm leading-6">
                        Rôle actuel :{" "}
                        <span className="font-semibold text-white">
                          {getRoleLabel(player.role)}
                        </span>
                      </p>

                      {player.role === "SUPER_ADMIN" ? (
                        <p className="mt-1.5 md:mt-2 text-xs text-white/60">
                          Le rôle SUPER_ADMIN est verrouillé ici.
                        </p>
                      ) : (
                        <form action={toggleUserRole} className="mt-1.5 md:mt-2">
                          <input type="hidden" name="userId" value={player.id} />

                          <button
                            type="submit"
                            className={`w-full px-5 py-2 md:py-2.5 ${
                              player.role === "ADMIN" ? "neon-button-secondary" : "neon-button"
                            }`}
                          >
                            {player.role === "ADMIN" ? "Retirer admin" : "Passer en admin"}
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-2.5 md:p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Réinitialiser le mot de passe
                      </p>

                      <p className="neon-text-muted mt-1 md:mt-1.5 text-sm leading-6">
                        Définit un mot de passe temporaire.
                      </p>

                      <form action={resetPlayerPassword} className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2">
                        <input type="hidden" name="userId" value={player.id} />

                        <input
                          name="password"
                          type="password"
                          minLength={8}
                          required
                          placeholder="Nouveau mot de passe"
                          className="w-full px-4 py-2 md:py-2.5"
                        />

                        <button
                          type="submit"
                          className="neon-button-secondary w-full px-5 py-2 md:py-2.5"
                        >
                          Modifier le mot de passe
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-rose-400/15 bg-rose-400/4 p-2.5 md:p-3">
                      <div className="flex items-center justify-between gap-1.5 md:gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300/80">
                          Bannissement
                        </p>
                        <span className={getStatusBadgeClass(player.status)}>
                          {player.status}
                        </span>
                      </div>

                      <form action={banPlayer} className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2">
                        <input type="hidden" name="userId" value={player.id} />
                        <input
                          name="reason"
                          type="text"
                          required
                          placeholder="Motif du bannissement"
                          className="w-full px-4 py-2 md:py-2.5"
                        />
                        <button
                          type="submit"
                          className="neon-button-secondary w-full px-5 py-2 md:py-2.5"
                        >
                          Bannir le joueur
                        </button>
                      </form>

                      <form action={liftBan} className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2">
                        <input type="hidden" name="userId" value={player.id} />
                        <input
                          name="reason"
                          type="text"
                          placeholder="Motif du déban (optionnel)"
                          className="w-full px-4 py-2 md:py-2.5"
                        />
                        <button type="submit" className="neon-button w-full px-5 py-2 md:py-2.5">
                          Déban
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                      Badges
                    </p>

                    {player.badges.length === 0 ? (
                      <p className="neon-text-muted mt-1.5 md:mt-2 text-sm">
                        Ce joueur n’a aucun badge pour le moment.
                      </p>
                    ) : (
                      <div className="mt-1.5 md:mt-2 flex flex-wrap gap-1.5 md:gap-2">
                        {player.badges.map(({ badge }) => {
                          const Icon = getBadgeIcon(badge.icon);
                          const colorClasses = getBadgeColorClasses(badge.color);

                          return (
                            <form key={badge.id} action={revokeBadge}>
                              <input type="hidden" name="userId" value={player.id} />
                              <input type="hidden" name="badgeId" value={badge.id} />
                              <button
                                type="submit"
                                title="Cliquer pour retirer"
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-70 ${colorClasses}`}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {badge.name}
                                <span className="ml-0.5 text-white/50">×</span>
                              </button>
                            </form>
                          );
                        })}
                      </div>
                    )}

                    {badgeCatalog.length > 0 ? (
                      <form action={awardBadge} className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2 sm:grid-cols-[1fr_auto]">
                        <input type="hidden" name="userId" value={player.id} />
                        <select name="badgeId" defaultValue="" required className="w-full px-4 py-2 md:py-2.5">
                          <option value="" disabled>
                            Choisir un badge à attribuer
                          </option>
                          {badgeCatalog.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="neon-button px-5 py-2 md:py-2.5">
                          Attribuer
                        </button>
                      </form>
                    ) : (
                      <p className="neon-text-muted mt-1.5 md:mt-2 text-xs">
                        Aucun badge créé pour le moment (Admin → Badges).
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                      Ajouter un avertissement
                    </p>

                    <form action={addWarning} className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <input type="hidden" name="userId" value={player.id} />

                      <select name="type" defaultValue="TOXICITY" className="w-full px-4 py-2 md:py-2.5">
                        <option value="TOXICITY">Toxicité</option>
                        <option value="ABSENCE">Absence</option>
                        <option value="AFK">AFK</option>
                        <option value="INSULT">Insulte</option>
                        <option value="CHEATING_SUSPECT">Suspicion de cheat</option>
                        <option value="TEAM_REFUSAL">Refus d’équipe</option>
                        <option value="SPAM">Spam</option>
                        <option value="OTHER">Autre</option>
                      </select>

                      <input
                        name="message"
                        type="text"
                        required
                        placeholder="Raison de l’avertissement"
                        className="w-full px-4 py-2 md:py-2.5"
                      />

                      <button type="submit" className="neon-button px-5 py-2 md:py-2.5">
                        Avertir
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 md:gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Historique des avertissements
                      </p>
                      <span className="neon-badge">{player.totalWarnings} total</span>
                    </div>

                    {player.warnings.length === 0 ? (
                      <p className="neon-text-muted mt-2 md:mt-3 text-sm">
                        Aucun avertissement pour ce joueur.
                      </p>
                    ) : (
                      <div className="mt-2 md:mt-3 grid gap-2 md:gap-2.5">
                        {player.warnings.map((warning) => (
                          <div
                            key={warning.id}
                            className="rounded-2xl border border-white/8 bg-black/20 p-2.5 md:p-3"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                              <span className="neon-badge">{getWarningTypeLabel(warning.type)}</span>

                              <span
                                className={
                                  warning.status === "ACTIVE"
                                    ? "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"
                                    : "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                                }
                              >
                                {warning.status}
                              </span>

                              <span className="text-xs text-white/50">
                                {formatDate(warning.createdAt)}
                              </span>
                            </div>

                            <p className="mt-1.5 md:mt-2 text-sm text-white">{warning.message}</p>

                            {warning.status === "ACTIVE" ? (
                              <div className="mt-2 md:mt-3 rounded-2xl border border-white/8 bg-white/[0.02] p-2.5 md:p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/80">
                                  Révoquer cet avertissement
                                </p>

                                <form
                                  action={revokeWarning}
                                  className="mt-1.5 md:mt-2 grid gap-1.5 md:gap-2 lg:grid-cols-[1fr_auto]"
                                >
                                  <input type="hidden" name="warningId" value={warning.id} />

                                  <input
                                    name="reason"
                                    type="text"
                                    placeholder="Motif de révocation (optionnel)"
                                    className="w-full px-4 py-2 md:py-2.5"
                                  />

                                  <button
                                    type="submit"
                                    className="neon-button-secondary px-5 py-2 md:py-2.5"
                                  >
                                    Révoquer
                                  </button>
                                </form>
                              </div>
                            ) : (
                              <div className="mt-2 md:mt-3 text-xs text-emerald-300/80">
                                <p>Révoqué le : {formatDate(warning.revokedAt)}</p>
                                {warning.revokedReason ? (
                                  <p className="mt-1">Motif : {warning.revokedReason}</p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}