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
import { PoolList, type PoolPlayer } from "@/components/mix/pool-list";
import { canSelfServeMix } from "@/server/mix/mix-access";
import { cleanupOldMixSessions } from "@/server/mix/cleanup-old-sessions";

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Rejoins d’abord la file BO7 pour pouvoir générer.";
    case "pool_forbidden":
      return "Un admin gère actuellement la file : tu ne peux pas retirer de joueur.";
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

export default async function BO7Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; removed?: string; session?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, isAvailableForBO7Mix: true },
  });
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isRemoved = sp.removed === "1";
  const sessionId = sp.session;
  const isInQueue = !!user.isAvailableForBO7Mix;

  const [queueUsers, queueTempPlayers, canManagePool] = await Promise.all([
    db.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED", isAvailableForBO7Mix: true },
      select: { id: true, username: true, platform: true },
      orderBy: { displayName: "asc" },
    }),
    db.tempPlayer.findMany({
      where: { game: "BO7", isAvailableForMix: true },
      select: { id: true, nickname: true },
      orderBy: { nickname: "asc" },
    }),
    canSelfServeMix("BO7", sessionUser.id),
  ]);

  const queueCount = queueUsers.length + queueTempPlayers.length;

  const poolPlayers: PoolPlayer[] = [
    ...queueUsers.map((p) => ({
      id: p.id,
      kind: "USER" as const,
      label: `@${p.username}`,
      sub: p.platform ?? undefined,
      isSelf: p.id === sessionUser.id,
    })),
    ...queueTempPlayers.map((p) => ({
      id: p.id,
      kind: "TEMP" as const,
      label: p.nickname,
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

  await cleanupOldMixSessions();

  const latestSession = sessionId
    ? await db.mixSession.findUnique({ where: { id: sessionId }, include: includeTeams })
    : await db.mixSession.findFirst({
        where: { game: "BO7" },
        orderBy: { createdAt: "desc" },
        include: includeTeams,
      });

  const teams = latestSession
    ? sortTeamsMineFirst(latestSession.teams, sessionUser.id)
    : [];

  const pastSessions = await db.mixSession.findMany({
    where: { game: "BO7" },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, createdAt: true },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300/75">
            BO7
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Mix Black Ops 7
          </h2>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
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
              {isInQueue ? "Prêt (BO7)" : "En attente"}
            </span>

            <span className="neon-badge">
              {queueCount} joueur{queueCount > 1 ? "s" : ""} dans la file
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:max-w-lg">
            <form action={toggleGameQueue}>
              <input type="hidden" name="game" value="BO7" />
              <button
                type="submit"
                className={`w-full px-4 py-3 ${isInQueue ? "neon-button-secondary" : "neon-button"}`}
              >
                {isInQueue ? "Quitter la file" : "Rejoindre la file"}
              </button>
            </form>

            <form action={generateMix}>
              <input type="hidden" name="game" value="BO7" />
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300/75">
            File d’attente
          </p>
          <PoolList game="BO7" players={poolPlayers} canManage={canManagePool} />
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
            basePath="/bo7"
            currentSessionId={latestSession?.id}
          />

          {teams.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">
              Aucune équipe BO7 pour le moment.
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
                          game: "BO7",
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
                                <span title="Hôte de la partie" className="text-sm leading-none">👑</span>
                              ) : null}
                            </div>
                            <p className="neon-text-muted mt-0.5 truncate text-[11px]">{sub}</p>
                            <p className="neon-text-muted mt-1 truncate text-[11px]">
                              Pseudo : <span className="text-white">{wz}</span> · {platform}
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
