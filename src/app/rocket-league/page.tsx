export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { toggleGameQueue } from "@/server/mix/toggle-game-queue";
import { generateMix } from "@/server/mix/generate-mix";
import { getTeamDisplayName } from "@/lib/team-names";
import { sortTeamsMineFirst } from "@/lib/mix-teams";
import { SessionHistory } from "@/components/mix/session-history";
import { TeamPager } from "@/components/mix/team-pager";
import { PoolList, type PoolPlayer } from "@/components/mix/pool-list";
import { canSelfServeMix, getMixManagingAdminName } from "@/server/mix/mix-access";
import { cleanupOldMixSessions } from "@/server/mix/cleanup-old-sessions";
import { rocketLeagueRankLabel } from "@/lib/ranks";
import { setTeamResult } from "@/server/mix/set-team-result";
import { setPlayerStats } from "@/server/mix/set-player-stats";

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Rejoins d’abord la file Rocket League pour pouvoir générer.";
    case "pool_forbidden":
      return "Un admin gère actuellement la file : tu ne peux pas retirer de joueur.";
    case "no_team_size":
      return "Un admin doit d’abord choisir le format 2v2 ou 3v3 avant de pouvoir générer.";
    case "rank_missing":
      return "Certains joueurs n’ont pas de rang Rocket League renseigné : génération impossible.";
    case "rank_gap":
      return "Impossible de créer des équipes équilibrées : écart de rang trop important.";
    case "invalid_count":
      return "Nombre de joueurs invalide pour le format choisi (doit être divisible par 2 ou 3).";
    case "locked":
      return "Un autre admin est sélectionné pour générer le mix Rocket League.";
    case "no_mix_admin":
      return "Un admin est en ligne : la génération est verrouillée tant qu’un générateur n’est pas sélectionné.";
    case "banned":
      return "Compte banni ou en attente. Action impossible.";
    case "result_forbidden":
      return "Tu dois faire partie de cette équipe pour modifier son résultat ou ses stats.";
    case "stats_invalid":
      return "Kills/morts invalides (nombres entiers entre 0 et 999).";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function RocketLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; removed?: string; session?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, isAvailableForRocketLeagueMix: true, rocketLeagueRank: true },
  });
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isRemoved = sp.removed === "1";
  const sessionId = sp.session;
  const isInQueue = !!user.isAvailableForRocketLeagueMix;

  const lock = await db.mixGenerationLock.findUnique({
    where: { game: "ROCKET_LEAGUE" },
    select: { rocketLeagueTeamSize: true },
  });

  const [queueUsers, queueTempPlayers, canManagePool, managingAdminName] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED", isAvailableForRocketLeagueMix: true },
      select: { id: true, username: true, rocketLeagueRank: true },
      orderBy: { displayName: "asc" },
    }),
    db.tempPlayer.findMany({
      where: { game: "ROCKET_LEAGUE", isAvailableForMix: true },
      select: { id: true, nickname: true, rocketLeagueRank: true },
      orderBy: { nickname: "asc" },
    }),
    canSelfServeMix("ROCKET_LEAGUE", sessionUser.id),
    getMixManagingAdminName("ROCKET_LEAGUE"),
  ]);

  const queueCount = queueUsers.length + queueTempPlayers.length;

  const poolPlayers: PoolPlayer[] = [
    ...queueUsers.map((p) => ({
      id: p.id,
      kind: "USER" as const,
      label: `@${p.username}`,
      sub: rocketLeagueRankLabel(p.rocketLeagueRank),
      isSelf: p.id === sessionUser.id,
    })),
    ...queueTempPlayers.map((p) => ({
      id: p.id,
      kind: "TEMP" as const,
      label: p.nickname,
      sub: rocketLeagueRankLabel(p.rocketLeagueRank),
    })),
  ];

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
                rocketLeagueRank: true,
              },
            },
            tempPlayer: { select: { id: true, nickname: true, note: true, rocketLeagueRank: true } },
          },
        },
      },
    },
  };

  await cleanupOldMixSessions();

  const latestSession = sessionId
    ? await db.mixSession.findUnique({ where: { id: sessionId }, include: includeTeams })
    : await db.mixSession.findFirst({
        where: { game: "ROCKET_LEAGUE" },
        orderBy: { createdAt: "desc" },
        include: includeTeams,
      });

  const teams = latestSession
    ? sortTeamsMineFirst(latestSession.teams, sessionUser.id)
    : [];

  const pastSessions = await db.mixSession.findMany({
    where: { game: "ROCKET_LEAGUE" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, createdAt: true },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
            Rocket League
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Mix Rocket League
          </h2>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Format 2v2 ou 3v3 choisi par un admin, avec contrainte de rang. Rejoins
            la file pour être pris en compte, puis consulte toutes les équipes (la
            tienne en premier).
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className={
                isInQueue
                  ? "inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                  : "inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/70"
              }
            >
              {isInQueue ? "Prêt (RL)" : "En attente"}
            </span>

            <span className="neon-badge">
              {queueCount} joueur{queueCount > 1 ? "s" : ""} dans la file
            </span>

            <span className="neon-badge">
              Rang : {user.rocketLeagueRank ?? "Non renseigné"}
            </span>

            <span className="neon-badge">
              Format :{" "}
              {lock?.rocketLeagueTeamSize === "TWO"
                ? "2v2"
                : lock?.rocketLeagueTeamSize === "THREE"
                  ? "3v3"
                  : "Non défini"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:max-w-lg">
            <form action={toggleGameQueue}>
              <input type="hidden" name="game" value="ROCKET_LEAGUE" />
              <button
                type="submit"
                className={`w-full px-4 py-3 ${isInQueue ? "neon-button-secondary" : "neon-button"}`}
              >
                {isInQueue ? "Quitter la file" : "Rejoindre la file"}
              </button>
            </form>

            <form action={generateMix}>
              <input type="hidden" name="game" value="ROCKET_LEAGUE" />
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

        {isRemoved ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Joueur retiré de la file avec succès.
            </p>
          </div>
        ) : null}

        <div className="neon-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
            File d’attente
          </p>
          <PoolList
            game="ROCKET_LEAGUE"
            players={poolPlayers}
            canManage={canManagePool}
            managingAdminName={managingAdminName}
          />
        </div>

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
            basePath="/rocket-league"
            currentSessionId={latestSession?.id}
          />

          {teams.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">
              Aucune équipe Rocket League pour le moment.
            </p>
          ) : (
            <TeamPager>
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
                          game: "ROCKET_LEAGUE",
                          sessionId: latestSession!.id,
                          teamNumber: team.teamNumber,
                        })}
                      </h4>
                      {isMine ? <span className="neon-badge text-[10px]">TON ÉQUIPE</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-white/60">Équipe #{team.teamNumber}</p>
                      {team.result ? (
                        <span
                          className={
                            team.result === "WIN"
                              ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300"
                              : "rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-rose-300"
                          }
                        >
                          {team.result === "WIN" ? "Victoire" : "Défaite"}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <form action={setTeamResult}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="result" value="WIN" />
                        <button
                          type="submit"
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300/80 transition hover:border-emerald-400/30 hover:bg-emerald-400/10"
                        >
                          Victoire
                        </button>
                      </form>
                      <form action={setTeamResult}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="result" value="LOSS" />
                        <button
                          type="submit"
                          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300/80 transition hover:border-rose-400/30 hover:bg-rose-400/10"
                        >
                          Défaite
                        </button>
                      </form>
                      {team.result ? (
                        <form action={setTeamResult}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="result" value="CLEAR" />
                          <button
                            type="submit"
                            className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50 transition hover:border-white/20 hover:bg-white/5"
                          >
                            Effacer
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="mt-3 grid gap-2">
                      {team.members.map((member) => {
                        const name = member.user?.displayName ?? member.tempPlayer?.nickname ?? "Joueur inconnu";
                        const sub = member.user?.username ? `@${member.user.username}` : "Joueur temporaire";
                        const rank = member.user?.rocketLeagueRank ?? member.tempPlayer?.rocketLeagueRank ?? "Non renseigné";

                        return (
                          <div
                            key={member.id}
                            className={
                              member.isHost
                                ? "rounded-xl border border-amber-400/30 bg-amber-400/6 p-2.5"
                                : "rounded-xl border border-white/8 bg-white/2 p-2.5"
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-semibold text-white">{name}</p>
                              {member.isHost ? (
                                <span
                                  title="Hôte de la partie : c’est chez lui qu’il faut rejoindre"
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-300"
                                >
                                  👑 Hôte à rejoindre
                                </span>
                              ) : null}
                            </div>
                            <p className="neon-text-muted mt-0.5 truncate text-[11px]">{sub}</p>
                            <p className="neon-text-muted mt-1 truncate text-[11px]">
                              Rang : <span className="text-white">{rank}</span>
                            </p>

                            <form action={setPlayerStats} className="mt-2 flex items-center gap-1.5">
                              <input type="hidden" name="teamMemberId" value={member.id} />
                              <input
                                type="number"
                                name="kills"
                                min={0}
                                max={999}
                                defaultValue={member.kills ?? ""}
                                placeholder="Kills"
                                className="w-16 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-center text-[11px] text-white placeholder:text-white/30"
                              />
                              <span className="text-[10px] text-white/30">/</span>
                              <input
                                type="number"
                                name="deaths"
                                min={0}
                                max={999}
                                defaultValue={member.deaths ?? ""}
                                placeholder="Morts"
                                className="w-16 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-center text-[11px] text-white placeholder:text-white/30"
                              />
                              <button
                                type="submit"
                                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-cyan-300/80 transition hover:border-cyan-400/30 hover:bg-cyan-400/10"
                              >
                                OK
                              </button>
                            </form>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </TeamPager>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
