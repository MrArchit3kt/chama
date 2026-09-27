export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireSuperAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import type { ActivityAction } from "@/generated/prisma/enums";
import { distinctMonths, monthLabel, monthRange } from "@/lib/month-filter";

const ACTIVITY_LABELS: Record<string, string> = {
  REGISTRATION_CREATED: "Nouvelle inscription",
  REGISTRATION_APPROVED: "Inscription acceptée",
  REGISTRATION_REJECTED: "Inscription refusée",
  ROLE_CHANGED: "Passage admin",
  ADMIN_PERMISSIONS_UPDATED: "Permissions admin modifiées",
  CHAMA_TOGGLED: "Statut CHAMA",
  AURA_TOGGLED: "Statut AURA",
  PLAYER_BANNED: "Bannissement",
  PLAYER_UNBANNED: "Déban",
  PLAYER_DELETED: "Suppression de compte",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  WARNING_ADDED: "Avertissement ajouté",
  WARNING_REVOKED: "Avertissement révoqué",
  BADGE_CREATED: "Badge créé",
  BADGE_DELETED: "Badge supprimé",
  BADGE_AWARDED: "Badge attribué",
  BADGE_REVOKED: "Badge retiré",
  DISCORD_CHANNEL_CREATED: "Salon Discord ajouté",
  DISCORD_CHANNEL_UPDATED: "Salon Discord modifié",
  DISCORD_CHANNEL_DELETED: "Salon Discord supprimé",
  EVENT_CREATED: "Événement créé",
  EVENT_UPDATED: "Événement modifié",
  EVENT_DELETED: "Événement supprimé",
  EVENT_ROSTER_UPDATED: "Composition d’équipe modifiée",
  CONTACT_CLOSED: "Demande de contact clôturée",
  SITE_CONFIG_UPDATED: "Config du site modifiée",
  MIX_GENERATED: "Mix généré",
  SCORE_GAME_MODE_CREATED: "Mode de jeu (points) créé",
  SCORE_CONDITION_CREATED: "Condition de points créée",
  SCORE_CONDITION_DELETED: "Condition de points supprimée",
  SCORE_BOARD_CREATED: "Tableau de points créé",
  SCORE_ENTRY_UPDATED: "Scores saisis",
  SCORE_TIER_CREATED: "Palier de points créé",
  SCORE_TIER_DELETED: "Palier de points supprimé",
  SCORE_TOURNAMENT_CREATED: "Tournoi créé",
  SCORE_TOURNAMENT_DELETED: "Tournoi supprimé",
  SCORE_BOARD_TOURNAMENT_SET: "Tableau rattaché à un tournoi",
  SCORE_CONDITION_UPDATED: "Condition de points modifiée",
  SCORE_BOARD_DELETED: "Tableau de points supprimé",
  SCORE_TEAM_DELETED: "Équipe (points) supprimée",
  SCORE_TEAM_MEMBER_REMOVED: "Joueur retiré d’une équipe (points)",
  SCORE_TOURNAMENT_STARTED: "Tournoi démarré",
  SCORE_TEAM_JOINED: "Joueur a rejoint une équipe (tournoi)",
  SCORE_TEAM_LEFT: "Joueur a quitté une équipe (tournoi)",
  SCORE_TEAMS_RANDOMIZED: "Équipes tirées au sort (tournoi)",
  SCORE_BRACKET_TEAM_ADDED: "Équipe(s) ajoutée(s) à un bracket",
  SCORE_MATCH_WINNER_SET: "Vainqueur de match déclaré (bracket)",
  SCORE_BRACKET_ROUND_ADVANCED: "Tour suivant généré (bracket)",
  SCORE_BRACKET_TEAM_MEMBER_ADDED: "Joueur ajouté à une équipe de bracket",
  SCORE_BRACKET_TEAM_MEMBER_REMOVED: "Joueur retiré d’une équipe de bracket",
  SCORE_TOURNAMENT_INTEREST_JOINED: "Joueur intéressé par un tournoi (sondage)",
  SCORE_TOURNAMENT_INTEREST_LEFT: "Joueur plus intéressé par un tournoi (sondage)",
  SCORE_BOARD_FINISHED: "Partie de tournoi terminée (scores verrouillés)",
  SCORE_BOARD_REOPENED: "Partie de tournoi rouverte (scores modifiables)",
};

const ACTIVITY_ORDER = Object.keys(ACTIVITY_LABELS);

function isActivityAction(value: string): value is ActivityAction {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_LABELS, value);
}

function getActivityLabel(action: string) {
  return ACTIVITY_LABELS[action] ?? action;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;

  const entries = Object.entries(metadata as Record<string, unknown>);
  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; month?: string }>;
}) {
  const superAdmin = await requireSuperAdmin();

  if (!superAdmin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const actionFilter = (sp.action ?? "").trim();
  const monthFilter = (sp.month ?? "").trim();
  const range = monthRange(monthFilter);

  // Léger : sert juste à peupler le sélecteur de mois avec ceux qui ont
  // réellement des entrées, indépendamment du filtre en cours.
  const allDates = await db.activityLog.findMany({ select: { createdAt: true } });
  const availableMonths = distinctMonths(allDates.map((d) => d.createdAt));

  // Un mois choisi borne déjà le volume : pas besoin du plafond de 100
  // (utile seulement en vue "tout confondu" pour éviter de tout charger).
  const logs = await db.activityLog.findMany({
    where: {
      ...(isActivityAction(actionFilter) ? { action: actionFilter } : {}),
      ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(range ? {} : { take: 100 }),
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300/75">
            Super Admin
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Journal d’activité
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Tout ce qui se passe sur le site : inscriptions, passages admin,
            statuts CHAMA/AURA, mix générés, bannissements, badges... Filtrable
            par mois et par type d’action ({!range ? "les 100 dernières entrées si aucun mois n’est choisi" : "toutes les entrées du mois choisi"}).
          </p>

          <form
            method="GET"
            className="mt-5 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:max-w-xl"
          >
            <select name="month" defaultValue={monthFilter} className="w-full px-4 py-2.5 text-sm">
              <option value="">Tous les mois</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <select
              name="action"
              defaultValue={actionFilter}
              className="w-full px-4 py-2.5 text-sm"
            >
              <option value="">Tous les types d’action</option>
              {ACTIVITY_ORDER.map((action) => (
                <option key={action} value={action}>
                  {getActivityLabel(action)}
                </option>
              ))}
            </select>
            <button type="submit" className="neon-button px-5 py-2.5 text-sm">
              Filtrer
            </button>
          </form>
        </div>

        <div className="neon-card p-5 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
              {actionFilter ? getActivityLabel(actionFilter) : "Toutes les actions"}
              {monthFilter ? ` · ${monthLabel(monthFilter)}` : ""}
            </p>
            <span className="neon-badge">{logs.length} entrée{logs.length > 1 ? "s" : ""}</span>
          </div>

          {logs.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">
              {actionFilter || monthFilter
                ? "Aucune activité ne correspond à ce filtre."
                : "Aucune activité enregistrée pour le moment."}
            </p>
          ) : (
            <div className="mt-4 grid gap-2.5">
              {logs.map((log) => {
                const metadataSummary = formatMetadata(log.metadata);

                return (
                  <div key={log.id} className="neon-card-soft p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="neon-badge text-[10px]">
                        {getActivityLabel(log.action)}
                      </span>
                      <span className="neon-text-muted text-[11px]">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-white">
                      <span className="font-semibold">{log.actorLabel}</span>
                      {log.targetLabel ? (
                        <>
                          {" "}
                          <span className="text-white/50">→</span>{" "}
                          <span className="font-semibold">{log.targetLabel}</span>
                        </>
                      ) : null}
                    </p>

                    {metadataSummary ? (
                      <p className="neon-text-muted mt-1 truncate text-[11px]" title={metadataSummary}>
                        {metadataSummary}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
