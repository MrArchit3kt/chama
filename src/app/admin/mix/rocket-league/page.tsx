export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { generateMix } from "@/server/mix/generate-mix";
import { setMixGenerator } from "@/server/mix/set-mix-generator";
import { cleanupOldMixSessions } from "@/server/mix/cleanup-old-sessions";
import { createTempPlayer } from "@/server/mix/create-temp-player";

function getErrorMessage(error?: string) {
  switch (error) {
    case "no_mix_admin":
      return "Sélectionne d’abord un admin autorisé à générer le mix Rocket League.";
    case "locked":
      return "Un autre admin est sélectionné pour générer le mix Rocket League.";
    case "no_team_size":
      return "Choisis d’abord le format 2v2 ou 3v3 pour Rocket League.";
    case "rank_missing":
      return "Un ou plusieurs joueurs n’ont pas renseigné leur rang Rocket League.";
    case "rank_gap":
      return "Impossible de former des équipes : l’écart de rang est trop grand pour certains groupes.";
    case "invalid_count":
      return "Nombre de joueurs invalide pour le format choisi (doit être divisible par 2 ou par 3).";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function AdminRocketLeagueMixPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    lock_set?: string;
    lock_cleared?: string;
    added?: string;
    session?: string;
  }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isAdded = sp.added === "1";
  const isLockSet = sp.lock_set === "1";
  const isLockCleared = sp.lock_cleared === "1";
  const sessionId = sp.session;

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

  const lock = await db.mixGenerationLock.findUnique({
    where: { game: "ROCKET_LEAGUE" },
    select: {
      game: true,
      selectedUserId: true,
      rocketLeagueTeamSize: true,
      selectedUser: {
        select: { id: true, displayName: true, username: true, role: true },
      },
    },
  });

  const poolUsers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      isAvailableForRocketLeagueMix: true,
    },
    select: {
      id: true,
      displayName: true,
      username: true,
      rocketLeagueRank: true,
    },
    orderBy: { displayName: "asc" },
  });

  // ✅ IMPORTANT: invités filtrés par jeu
  const tempPlayersRL = await db.tempPlayer.findMany({
    where: { game: "ROCKET_LEAGUE", isAvailableForMix: true },
    select: {
      id: true,
      nickname: true,
      note: true,
      rocketLeagueRank: true,
      createdAt: true,
    },
    orderBy: { nickname: "asc" },
  });

  const totalPoolCount = poolUsers.length; // (si tu veux inclure invités => totalPoolCount = poolUsers.length + tempPlayersRL.length)

  const canCurrentAdminGenerate =
    !!lock?.selectedUserId && lock.selectedUserId === admin.id;

  const canGenerate =
    totalPoolCount > 0 &&
    !!lock?.selectedUserId &&
    canCurrentAdminGenerate &&
    !!lock?.rocketLeagueTeamSize &&
    (lock.rocketLeagueTeamSize === "TWO"
      ? totalPoolCount % 2 === 0
      : totalPoolCount % 3 === 0);

  await cleanupOldMixSessions();

  const latestSession = sessionId
    ? await db.mixSession.findUnique({
        where: { id: sessionId },
        include: { teams: { include: { members: true } } },
      })
    : await db.mixSession.findFirst({
        where: { game: "ROCKET_LEAGUE" },
        orderBy: { createdAt: "desc" },
        include: { teams: { include: { members: true } } },
      });

  return (
    <SiteShell>
      <div className="grid gap-5">
        <div className="neon-card p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Rocket League Mix (Admin)
          </p>
          <h2 className="neon-title neon-gradient-text mt-2 text-2xl font-black md:text-3xl">
            Rocket League Mix
          </h2>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:text-base">
            Génération d’équipes Rocket League en 2v2 ou 3v3, avec contrainte de rang.
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

        {isAdded ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Invité ajouté avec succès.
            </p>
          </div>
        ) : null}

        {isLockSet ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-cyan-300">
              Sélection mise à jour.
            </p>
          </div>
        ) : null}

        {isLockCleared ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Sélection retirée.
            </p>
          </div>
        ) : null}

        {/* contrôle générateur */}
        <div className="neon-card p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Admin autorisé + format
                </p>
                <h3 className="mt-1 text-base font-bold text-white">
                  Contrôle du générateur (Rocket League)
                </h3>
                <p className="neon-text-muted mt-1 text-xs leading-5">
                  Un seul admin peut générer ce mix. Choisis aussi 2v2 ou 3v3.
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 lg:min-w-[260px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Sélectionné
                </p>
                <p className="mt-1 truncate text-xs font-medium text-white">
                  {lock?.selectedUser
                    ? `${lock.selectedUser.displayName} (@${lock.selectedUser.username})`
                    : "Aucun admin"}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  Format :{" "}
                  <span className="text-white">
                    {lock?.rocketLeagueTeamSize === "TWO"
                      ? "2v2"
                      : lock?.rocketLeagueTeamSize === "THREE"
                        ? "3v3"
                        : "Non défini"}
                  </span>
                </p>
              </div>
            </div>

            <form
              action={setMixGenerator}
              className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
            >
              <input type="hidden" name="game" value="ROCKET_LEAGUE" />

              <select
                name="selectedAdminId"
                defaultValue={lock?.selectedUserId ?? ""}
                className="w-full px-3 py-2.5 text-sm"
              >
                <option value="">Aucun admin</option>
                {onlineAdmins.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} (@{item.username}) — {item.role}
                  </option>
                ))}
              </select>

              <select
                name="rlTeamSize"
                defaultValue={lock?.rocketLeagueTeamSize ?? ""}
                className="w-full px-3 py-2.5 text-sm"
              >
                <option value="">Format ?</option>
                <option value="TWO">2v2</option>
                <option value="THREE">3v3</option>
              </select>

              <button
                type="submit"
                className="neon-button px-4 py-2.5 text-sm sm:min-w-[220px]"
              >
                Enregistrer
              </button>
            </form>
          </div>
        </div>

        {/* invités RL */}
        <div className="neon-card p-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Ajouter un joueur temporaire
              </p>
              <h3 className="mt-1 text-base font-bold text-white">
                Joueur invité (Rocket League)
              </h3>
              <p className="neon-text-muted mt-1 text-xs leading-5">
                Cet invité sera ajouté UNIQUEMENT au pool Rocket League.
              </p>
            </div>

            <form
              action={createTempPlayer}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_180px_auto]"
            >
              <input type="hidden" name="game" value="ROCKET_LEAGUE" />

              <input
                name="nickname"
                type="text"
                required
                placeholder="Pseudo joueur"
                className="w-full px-3 py-2.5 text-sm"
              />
              <input
                name="note"
                type="text"
                placeholder="Note optionnelle"
                className="w-full px-3 py-2.5 text-sm"
              />

              <select
                name="rocketLeagueRank"
                defaultValue=""
                className="w-full px-3 py-2.5 text-sm"
              >
                <option value="">Rang ? (optionnel)</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Argent</option>
                <option value="GOLD">Or</option>
                <option value="PLATINUM">Platine</option>
                <option value="DIAMOND">Diamant</option>
                <option value="CHAMPION">Champion</option>
                <option value="GRAND_CHAMPION">Grand Champion</option>
                <option value="SSL">SSL</option>
              </select>

              <button
                type="submit"
                className="neon-button px-4 py-2.5 text-sm sm:min-w-[220px]"
              >
                Ajouter
              </button>
            </form>
          </div>
        </div>

        {/* pool + génération */}
        <div className="neon-card p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Pool Rocket League
              </p>
              <h3 className="mt-2 text-xl font-bold text-white md:text-2xl">
                {totalPoolCount} joueur{totalPoolCount > 1 ? "s" : ""}
              </h3>
              <p className="neon-text-muted mt-2 text-sm">
                Le mix respecte le format choisi (2v2/3v3) + écart de rang limité.
              </p>
            </div>

            <form action={generateMix}>
              <input type="hidden" name="game" value="ROCKET_LEAGUE" />
              <button
                type="submit"
                className={`px-5 py-3 ${
                  canGenerate ? "neon-button" : "neon-button-secondary opacity-60"
                }`}
                disabled={!canGenerate}
              >
                Générer
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {poolUsers.length === 0 ? (
              <div className="neon-card-soft p-4">
                <p className="neon-text-muted text-sm">Aucun joueur dans le pool.</p>
              </div>
            ) : (
              poolUsers.map((p) => (
                <div key={p.id} className="neon-card-soft p-3">
                  <h4 className="truncate text-sm font-bold text-white">{p.displayName}</h4>
                  <p className="neon-text-muted mt-1 truncate text-[11px]">@{p.username}</p>
                  <p className="neon-text-muted mt-2 truncate text-[11px]">
                    Rang : <span className="text-white">{p.rocketLeagueRank ?? "?"}</span>
                  </p>
                </div>
              ))
            )}
          </div>

          {/* ✅ liste invités RL */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Invités Rocket League
            </p>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {tempPlayersRL.length === 0 ? (
                <div className="neon-card-soft p-4">
                  <p className="neon-text-muted text-sm">Aucun invité Rocket League.</p>
                </div>
              ) : (
                tempPlayersRL.map((t) => (
                  <div key={t.id} className="neon-card-soft p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="truncate text-sm font-bold text-white">{t.nickname}</h4>
                      <span className="neon-badge text-[10px]">INVITÉ</span>
                    </div>

                    <p className="neon-text-muted mt-2 truncate text-[11px]">
                      Rang : <span className="text-white">{t.rocketLeagueRank ?? "?"}</span>
                    </p>

                    {t.note ? (
                      <p className="neon-text-muted mt-1 truncate text-[11px]">
                        Note : <span className="text-white">{t.note}</span>
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {latestSession ? (
            <p className="mt-4 text-xs text-white/40">
              Dernière session: {latestSession.id.slice(-6).toUpperCase()}
            </p>
          ) : null}
        </div>
      </div>
    </SiteShell>
  );
}