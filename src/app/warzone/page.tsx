export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { toggleGameQueue } from "@/server/mix/toggle-game-queue";
import { generateMix } from "@/server/mix/generate-mix";
import { getTeamDisplayName } from "@/lib/team-names";
import { sortTeamsMineFirst } from "@/lib/mix-teams";
import { SessionHistory } from "@/components/mix/session-history";

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Rejoins d’abord la file Warzone pour pouvoir générer.";
    case "invalid_count":
      return "Nombre de joueurs invalide pour une répartition en équipes de 3 et 4 (ex: 1, 2 ou 5).";
    case "locked":
      return "Un autre admin est actuellement sélectionné pour générer les équipes.";
    case "no_mix_admin":
      return "Un admin est en ligne : la génération est verrouillée tant qu’un générateur n’est pas sélectionné.";
    case "banned":
      return "Compte banni ou en attente. Action impossible.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function WarzonePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; session?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, isAvailableForWarzoneMix: true },
  });
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const sessionId = sp.session;
  const isInQueue = !!user.isAvailableForWarzoneMix;

  const [queueUserCount, queueTempCount] = await Promise.all([
    db.user.count({
      where: { status: "ACTIVE", registrationStatus: "APPROVED", isAvailableForWarzoneMix: true },
    }),
    db.tempPlayer.count({ where: { game: "WARZONE", isAvailableForMix: true } }),
  ]);
  const queueCount = queueUserCount + queueTempCount;

  const includeTeams = {
    teams: {
      orderBy: { teamNumber: "asc" as const },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                warzoneUsername: true,
                platform: true,
              },
            },
            tempPlayer: { select: { id: true, nickname: true, note: true } },
          },
        },
      },
    },
  };

  const latestSession = sessionId
    ? await db.mixSession.findUnique({ where: { id: sessionId }, include: includeTeams })
    : await db.mixSession.findFirst({
        where: { game: "WARZONE" },
        orderBy: { createdAt: "desc" },
        include: includeTeams,
      });

  const teams = latestSession
    ? sortTeamsMineFirst(latestSession.teams, sessionUser.id)
    : [];

  const pastSessions = await db.mixSession.findMany({
    where: { game: "WARZONE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, createdAt: true },
  });

  return (
    <SiteShell>
      <AutoRefresh intervalMs={6000} />

      <div className="grid gap-6">
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Warzone
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Mix Warzone
          </h2>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Rejoins la file pour être pris en compte dans le prochain mix, puis
            consulte toutes les équipes générées (la tienne en premier).
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={
                isInQueue
                  ? "inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                  : "inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/70"
              }
            >
              {isInQueue ? "Prêt (Warzone)" : "En attente"}
            </span>

            <span className="neon-badge">
              {queueCount} joueur{queueCount > 1 ? "s" : ""} dans la file
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:max-w-lg">
            <form action={toggleGameQueue}>
              <input type="hidden" name="game" value="WARZONE" />
              <button
                type="submit"
                className={`w-full px-4 py-3 ${isInQueue ? "neon-button-secondary" : "neon-button"}`}
              >
                {isInQueue ? "Quitter la file" : "Rejoindre la file"}
              </button>
            </form>

            <form action={generateMix}>
              <input type="hidden" name="game" value="WARZONE" />
              <button
                type="submit"
                className="neon-button-secondary w-full px-4 py-3"
                disabled={!isInQueue}
                title={
                  isInQueue
                    ? "Générer si autorisé (0 admin en ligne ou sélection lock)"
                    : "Rejoins la file pour pouvoir générer quand c’est permis"
                }
              >
                Générer les équipes
              </button>
            </form>
          </div>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">
              Équipes générées avec succès.
            </p>
          </div>
        ) : null}

        <div className="neon-card p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Toutes les équipes
              </p>
              <h3 className="mt-2 text-xl font-bold text-white md:text-2xl">
                {latestSession
                  ? `Session ${latestSession.id.slice(-6).toUpperCase()}`
                  : "Aucun mix généré pour le moment"}
              </h3>
            </div>

            {latestSession ? (
              <span className="neon-badge">
                {teams.length} team{teams.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          <SessionHistory
            sessions={pastSessions}
            basePath="/warzone"
            currentSessionId={latestSession?.id}
          />

          {teams.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">
              Aucune équipe Warzone pour le moment.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {teams.map((team) => {
                const isMine = team.members.some((m) => m.userId === sessionUser.id);

                return (
                  <div
                    key={team.id}
                    className={
                      isMine
                        ? "neon-card-soft border border-cyan-400/30 p-4"
                        : "neon-card-soft p-4"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-bold text-white">
                        {getTeamDisplayName({
                          game: "WARZONE",
                          sessionId: latestSession!.id,
                          teamNumber: team.teamNumber,
                        })}
                      </h4>
                      {isMine ? <span className="neon-badge text-[10px]">TON ÉQUIPE</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-white/60">Équipe #{team.teamNumber}</p>

                    <div className="mt-3 grid gap-2">
                      {team.members.map((member) => {
                        const name = member.user?.displayName ?? member.tempPlayer?.nickname ?? "Joueur inconnu";
                        const sub = member.user?.username ? `@${member.user.username}` : "Joueur temporaire";
                        const wz = member.user?.warzoneUsername ?? member.tempPlayer?.nickname ?? "Non renseigné";
                        const platform = member.user?.platform ?? "Temporaire";

                        return (
                          <div key={member.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
                            <p className="truncate text-sm font-semibold text-white">{name}</p>
                            <p className="neon-text-muted mt-0.5 truncate text-[11px]">{sub}</p>
                            <p className="neon-text-muted mt-1 truncate text-[11px]">
                              Warzone : <span className="text-white">{wz}</span> · {platform}
                            </p>
                          </div>
                        );
                      })}
                    </div>
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
