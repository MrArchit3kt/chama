export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { generateMix } from "@/server/mix/generate-mix";
import { removePlayerFromPool } from "@/server/mix/remove-player-from-pool";
import { addPlayerToPool } from "@/server/mix/add-player-to-pool";
import { createTempPlayer } from "@/server/mix/create-temp-player";
import { setMixGenerator } from "@/server/mix/set-mix-generator";
import { cleanupOldMixSessions } from "@/server/mix/cleanup-old-sessions";
import { setTeamResult } from "@/server/mix/set-team-result";

function getErrorMessage(error?: string) {
  switch (error) {
    case "invalid_count":
      return "Nombre de joueurs invalide pour une répartition en équipes de 3 et 4 (ex: 1, 2 ou 5).";
    case "locked":
      return "Un autre admin est actuellement sélectionné pour générer les équipes.";
    case "no_mix_admin":
      return "Sélectionne d’abord un admin autorisé à générer les équipes.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

function getTeamSizesPreview(total: number): number[] | null {
  if (total < 3) return null;
  if (total === 5) return null;

  for (let teamsOf4 = Math.floor(total / 4); teamsOf4 >= 0; teamsOf4 -= 1) {
    const remainder = total - teamsOf4 * 4;
    if (remainder % 3 === 0) {
      const teamsOf3 = remainder / 3;
      return [...Array(teamsOf4).fill(4), ...Array(teamsOf3).fill(3)];
    }
  }
  return null;
}

function formatTeamSizesPreview(total: number) {
  const sizes = getTeamSizesPreview(total);
  if (!sizes) return "Impossible";

  const teamsOf4 = sizes.filter((s) => s === 4).length;
  const teamsOf3 = sizes.filter((s) => s === 3).length;

  const parts: string[] = [];
  if (teamsOf4 > 0) parts.push(`${teamsOf4}x4`);
  if (teamsOf3 > 0) parts.push(`${teamsOf3}x3`);
  return parts.join(" + ");
}

export default async function AdminMixBO7Page({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    removed?: string;
    added?: string;
    lock_set?: string;
    lock_cleared?: string;
    session?: string;
  }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isRemoved = sp.removed === "1";
  const isAdded = sp.added === "1";
  const isLockSet = sp.lock_set === "1";
  const isLockCleared = sp.lock_cleared === "1";
  const sessionId = sp.session;

  const availableUsers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      isAvailableForBO7Mix: true,
    },
    select: {
      id: true,
      displayName: true,
      username: true,
      warzoneUsername: true,
      platform: true,
    },
    orderBy: { displayName: "asc" },
  });

  const availableTempPlayers = await db.tempPlayer.findMany({
    where: { game: "BO7", isAvailableForMix: true },
    select: {
      id: true,
      nickname: true,
      note: true,
      createdAt: true,
    },
    orderBy: { nickname: "asc" },
  });

  const availableUserIds = availableUsers.map((p) => p.id);

  const poolCandidates = await db.user.findMany({
    where: {
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      isAvailableForBO7Mix: false,
      id: { notIn: availableUserIds.length > 0 ? availableUserIds : undefined },
    },
    select: {
      id: true,
      displayName: true,
      username: true,
      warzoneUsername: true,
      platform: true,
    },
    orderBy: { displayName: "asc" },
  });

  const onlineAdmins = await db.user.findMany({
    where: {
      isOnline: true,
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
    },
    select: { id: true, displayName: true, username: true, role: true },
    orderBy: { displayName: "asc" },
  });

  const mixLock = await db.mixGenerationLock.findUnique({
    where: { game: "BO7" },
    select: {
      game: true,
      selectedUserId: true,
      selectedUser: {
        select: { id: true, displayName: true, username: true, role: true },
      },
    },
  });

  const totalPoolCount = availableUsers.length + availableTempPlayers.length;
  const poolDistribution = formatTeamSizesPreview(totalPoolCount);
  const canGenerateByCount = poolDistribution !== "Impossible";

  const canCurrentAdminGenerate =
    !!mixLock?.selectedUserId && mixLock.selectedUserId === admin.id;

  const canGenerate = canGenerateByCount && canCurrentAdminGenerate;

  await cleanupOldMixSessions();

  const latestSession = sessionId
    ? await db.mixSession.findUnique({
        where: { id: sessionId },
        include: {
          teams: {
            orderBy: { teamNumber: "asc" },
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
        },
      })
    : await db.mixSession.findFirst({
        where: { game: "BO7" },
        orderBy: { createdAt: "desc" },
        include: {
          teams: {
            orderBy: { teamNumber: "asc" },
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
        },
      });

  return (
    <SiteShell>
      <div className="grid gap-5">
        <div className="neon-card p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            BO7 Mix (Admin)
          </p>
          <h2 className="neon-title neon-gradient-text mt-2 text-2xl font-black md:text-3xl">
            Mélangeur d’équipes BO7
          </h2>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:text-base">
            Le système répartit les joueurs du pool en équipes de 4 et 3. Aucun remplaçant, aucun joueur laissé de côté.
          </p>
        </div>

        {/* feedback */}
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
              Joueur retiré du pool avec succès.
            </p>
          </div>
        ) : null}
        {isAdded ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Joueur ajouté au pool avec succès.
            </p>
          </div>
        ) : null}
        {isLockSet ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-cyan-300">
              Admin autorisé à générer mis à jour avec succès.
            </p>
          </div>
        ) : null}
        {isLockCleared ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Sélection de l’admin générateur retirée.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {/* lock admin */}
          <div className="neon-card p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                    Admin autorisé à générer
                  </p>
                  <h3 className="mt-1 text-base font-bold text-white">Contrôle du générateur</h3>
                  <p className="neon-text-muted mt-1 text-xs leading-5">
                    Un seul admin peut générer les équipes à la fois.
                  </p>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 lg:min-w-[220px]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Sélectionné
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-white">
                    {mixLock?.selectedUser
                      ? `${mixLock.selectedUser.displayName} (@${mixLock.selectedUser.username})`
                      : "Aucun admin"}
                  </p>
                </div>
              </div>

              <form action={setMixGenerator} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="game" value="BO7" />

                <select
                  name="selectedAdminId"
                  defaultValue={mixLock?.selectedUserId ?? ""}
                  className="w-full px-3 py-2.5 text-sm"
                >
                  <option value="">Aucun admin</option>
                  {onlineAdmins.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} (@{item.username}) — {item.role}
                    </option>
                  ))}
                </select>

                <button type="submit" className="neon-button px-4 py-2.5 text-sm sm:min-w-[210px]">
                  Enregistrer la sélection
                </button>
              </form>
            </div>
          </div>

          {/* temp player */}
          <div className="neon-card p-4">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Ajouter un joueur temporaire
                </p>
                <h3 className="mt-1 text-base font-bold text-white">Joueur invité sans compte</h3>
                <p className="neon-text-muted mt-1 text-xs leading-5">
                  Ajoute un pseudo temporaire directement dans le pool BO7.
                </p>
              </div>

              <form action={createTempPlayer} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="game" value="BO7" />
                <input
                  name="nickname"
                  type="text"
                  required
                  placeholder="Pseudo BO7"
                  className="w-full px-3 py-2.5 text-sm"
                />
                <input
                  name="note"
                  type="text"
                  placeholder="Note optionnelle"
                  className="w-full px-3 py-2.5 text-sm"
                />
                <button type="submit" className="neon-button px-4 py-2.5 text-sm sm:min-w-[220px]">
                  Ajouter
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* pool */}
        <div className="neon-card p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Joueurs disponibles
              </p>
              <h3 className="mt-2 text-xl font-bold text-white md:text-2xl">
                {totalPoolCount} joueur{totalPoolCount > 1 ? "s" : ""} prêt{totalPoolCount > 1 ? "s" : ""}
              </h3>
              <p className="neon-text-muted mt-2 text-sm">
                Les joueurs restent dans le pool jusqu’à retrait manuel ou déconnexion.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="neon-card-soft px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Total pool
                </p>
                <p className="neon-title neon-gradient-text mt-1 text-lg font-black md:text-xl">
                  {totalPoolCount}
                </p>
              </div>

              <div className="neon-card-soft px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                  Répartition
                </p>
                <p className="mt-1 text-lg font-black text-white md:text-xl">{poolDistribution}</p>
              </div>

              <form action={generateMix}>
                <input type="hidden" name="game" value="BO7" />
                <button
                  type="submit"
                  className={`px-5 py-3 ${canGenerate ? "neon-button" : "neon-button-secondary opacity-60"}`}
                  disabled={!canGenerate}
                >
                  Générer
                </button>
              </form>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {totalPoolCount === 0 ? (
              <div className="neon-card-soft p-4">
                <p className="neon-text-muted text-sm">Aucun joueur disponible pour le moment.</p>
              </div>
            ) : (
              <>
                {availableUsers.map((player) => (
                  <div key={`user-${player.id}`} className="neon-card-soft p-3">
                    <h4 className="truncate text-sm font-bold text-white">{player.displayName}</h4>
                    <p className="neon-text-muted mt-1 truncate text-[11px]">@{player.username}</p>
                    <p className="neon-text-muted mt-2 truncate text-[11px]">
                      Pseudo : <span className="text-white">{player.warzoneUsername}</span>
                    </p>
                    <p className="neon-text-muted mt-1 truncate text-[11px]">
                      Plateforme : <span className="text-white">{player.platform ?? "Non renseignée"}</span>
                    </p>

                    <div className="mt-2.5">
                      <form action={removePlayerFromPool}>
                        <input type="hidden" name="userId" value={player.id} />
                        <input type="hidden" name="game" value="BO7" />
                        <button type="submit" className="neon-button-secondary w-full px-3 py-2 text-xs">
                          Retirer du pool
                        </button>
                      </form>
                    </div>
                  </div>
                ))}

                {availableTempPlayers.map((player) => (
                  <div key={`temp-${player.id}`} className="neon-card-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-bold text-white">{player.nickname}</h4>
                      <span className="neon-badge text-[10px]">INVITÉ</span>
                    </div>

                    <p className="neon-text-muted mt-2 text-[11px]">Invité BO7</p>

                    {player.note ? (
                      <p className="neon-text-muted mt-1 truncate text-[11px]">
                        Note : <span className="text-white">{player.note}</span>
                      </p>
                    ) : null}

                    <div className="mt-2.5">
                      <form action={removePlayerFromPool}>
                        <input type="hidden" name="tempPlayerId" value={player.id} />
                        <input type="hidden" name="game" value="BO7" />
                        <button type="submit" className="neon-button-secondary w-full px-3 py-2 text-xs">
                          Retirer du pool
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* candidates */}
        <div className="neon-card p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Ajouter un joueur existant
          </p>
          <h3 className="mt-2 text-lg font-bold text-white md:text-xl">
            Ajouter un joueur inscrit au pool
          </h3>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {poolCandidates.length === 0 ? (
              <div className="neon-card-soft p-4">
                <p className="neon-text-muted text-sm">Aucun joueur éligible à ajouter pour le moment.</p>
              </div>
            ) : (
              poolCandidates.map((player) => (
                <div key={player.id} className="neon-card-soft p-3">
                  <h4 className="truncate text-sm font-bold text-white">{player.displayName}</h4>
                  <p className="neon-text-muted mt-1 truncate text-[11px]">@{player.username}</p>
                  <p className="neon-text-muted mt-2 truncate text-[11px]">
                    Pseudo : <span className="text-white">{player.warzoneUsername}</span>
                  </p>
                  <p className="neon-text-muted mt-1 truncate text-[11px]">
                    Plateforme : <span className="text-white">{player.platform ?? "Non renseignée"}</span>
                  </p>

                  <div className="mt-2.5">
                    <form action={addPlayerToPool}>
                      <input type="hidden" name="userId" value={player.id} />
                      <input type="hidden" name="game" value="BO7" />
                      <button type="submit" className="neon-button w-full px-3 py-2 text-xs">
                        Ajouter au pool
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* session */}
        {latestSession ? (
          <div className="neon-card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
                  Dernier mix généré
                </p>
                <h3 className="mt-2 text-lg font-bold text-white md:text-2xl">
                  Session {latestSession.id.slice(-6).toUpperCase()}
                </h3>
              </div>

              <span className="neon-badge">
                {latestSession.teams.length} team{latestSession.teams.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {latestSession.teams.map((team) => (
                <div key={team.id} className="neon-card-soft p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white md:text-base">Team {team.teamNumber}</h4>
                    <span className="neon-badge text-[10px]">
                      {team.members.length} joueur{team.members.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {team.result ? (
                      <span
                        className={
                          team.result === "WIN"
                            ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300"
                            : "rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-300"
                        }
                      >
                        {team.result === "WIN" ? "Victoire" : "Défaite"}
                      </span>
                    ) : null}

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

                  <div className="mt-2.5 grid gap-2">
                    {team.members.map((member) => {
                      const label = member.user ? member.user.displayName : member.tempPlayer?.nickname ?? "Invité";
                      const subLabel = member.user ? `@${member.user.username}` : "Joueur temporaire";
                      const pseudo = member.user ? member.user.warzoneUsername : member.tempPlayer?.note ?? "Invité";

                      return (
                        <div
                          key={member.id}
                          className={
                            member.isHost
                              ? "rounded-xl border border-amber-400/30 bg-amber-400/6 p-2.5"
                              : "rounded-xl border border-white/8 bg-white/2 p-2.5"
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-white md:text-sm">{label}</p>
                              {member.isHost ? (
                                <span
                                  title="Hôte de la partie : c’est chez lui qu’il faut rejoindre"
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-300"
                                >
                                  👑 Hôte à rejoindre
                                </span>
                              ) : null}
                            </div>
                            {!member.user ? <span className="neon-badge text-[10px]">INVITÉ</span> : null}
                          </div>
                          <p className="neon-text-muted mt-0.5 truncate text-[11px]">{subLabel}</p>
                          <p className="neon-text-muted mt-1 truncate text-[11px]">{pseudo}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}
