export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createGameMode } from "@/server/points/create-game-mode";
import { toggleGameMode } from "@/server/points/toggle-game-mode";
import { createCondition } from "@/server/points/create-condition";
import { deleteCondition } from "@/server/points/delete-condition";
import { createTier } from "@/server/points/create-tier";
import { deleteTier } from "@/server/points/delete-tier";
import { hasAdminPermission } from "@/lib/admin-permissions";

function getErrorMessage(error?: string) {
  switch (error) {
    case "forbidden":
      return "Tu n’as pas les droits pour effectuer cette action.";
    case "validation":
      return "Formulaire invalide. Vérifie les champs.";
    case "name_taken":
      return "Un mode de jeu porte déjà ce nom.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

function getModeLabel(mode: string) {
  if (mode === "QUANTITY") return "Quantité (nombre saisi × points)";
  if (mode === "TIERED") return "Paliers (tranches de valeurs)";
  return "Ponctuelle (case à cocher)";
}

function formatTierRange(tier: { minValue: number; maxValue: number | null }) {
  return tier.maxValue === null ? `${tier.minValue}+` : `${tier.minValue}–${tier.maxValue}`;
}

function getTargetLabel(target: string) {
  return target === "TEAM" ? "Équipe entière" : "Joueur précis";
}

export default async function AdminPointsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; deleted?: string; toggled?: string }>;
}) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const canConfig = hasAdminPermission(admin.role, admin.adminPermissions, "points.config");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isDeleted = sp.deleted === "1";
  const isToggled = sp.toggled === "1";

  const gameModes = await db.scoreGameMode.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      conditions: {
        orderBy: { createdAt: "asc" },
        include: { tiers: { orderBy: { minValue: "asc" } } },
      },
      _count: { select: { boards: true } },
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Admin Points
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Modes de jeu &amp; conditions de points
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Crée un mode de jeu, définis ses conditions (qui rapportent des
            points à l’équipe ou à un joueur précis), puis va sur sa page
            pour créer des tableaux et saisir les scores.
          </p>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">Enregistré avec succès.</p>
          </div>
        ) : null}

        {isDeleted ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">Condition supprimée.</p>
          </div>
        ) : null}

        {isToggled ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-cyan-300">Statut du mode de jeu mis à jour.</p>
          </div>
        ) : null}

        {canConfig ? (
          <div className="neon-card p-5 md:p-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">Créer un mode de jeu</h2>

            <form action={createGameMode} className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Nom</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ex : Warzone Battle Royale"
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Description (optionnel)
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Explique en quoi consiste ce mode de jeu."
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <button type="submit" className="neon-button px-5 py-2.5">
                  Créer le mode de jeu
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {gameModes.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">Aucun mode de jeu créé pour le moment.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {gameModes.map((gameMode) => (
              <div key={gameMode.id} className="neon-card p-5 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-white md:text-xl">{gameMode.name}</h3>
                      <span
                        className={
                          gameMode.isActive
                            ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"
                            : "rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60"
                        }
                      >
                        {gameMode.isActive ? "Actif" : "Inactif"}
                      </span>
                      <span className="neon-badge text-[10px]">
                        {gameMode._count.boards} tableau{gameMode._count.boards > 1 ? "x" : ""}
                      </span>
                    </div>
                    {gameMode.description ? (
                      <p className="neon-text-muted mt-2 max-w-2xl text-sm leading-6">
                        {gameMode.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <Link
                      href={`/admin/points/${gameMode.id}`}
                      className="neon-button px-4 py-2.5 text-sm"
                    >
                      Gérer les tableaux
                    </Link>

                    {canConfig ? (
                      <form action={toggleGameMode}>
                        <input type="hidden" name="id" value={gameMode.id} />
                        <button type="submit" className="neon-button-secondary px-4 py-2.5 text-sm">
                          {gameMode.isActive ? "Désactiver" : "Activer"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                    Conditions de points
                  </p>

                  {gameMode.conditions.length === 0 ? (
                    <p className="neon-text-muted mt-2 text-sm">
                      Aucune condition définie pour ce mode.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {gameMode.conditions.map((condition) => (
                        <div key={condition.id} className="neon-card-soft p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-white">
                              {condition.label}
                            </p>
                            {condition.mode !== "TIERED" ? (
                              <span
                                className={
                                  condition.points < 0
                                    ? "neon-badge border-rose-400/25 text-rose-300 text-[10px]"
                                    : "neon-badge text-[10px]"
                                }
                              >
                                {condition.points} pt{Math.abs(condition.points) > 1 ? "s" : ""}
                              </span>
                            ) : null}
                          </div>
                          <p className="neon-text-muted mt-1.5 text-[11px]">
                            {getTargetLabel(condition.appliesTo)} ·{" "}
                            {getModeLabel(condition.mode)}
                          </p>

                          {condition.mode === "TIERED" ? (
                            <div className="mt-2.5 rounded-xl border border-white/8 bg-black/20 p-2.5">
                              {condition.tiers.length === 0 ? (
                                <p className="text-[11px] text-white/40">Aucun palier défini.</p>
                              ) : (
                                <div className="grid gap-1.5">
                                  {condition.tiers.map((tier) => (
                                    <div
                                      key={tier.id}
                                      className="flex items-center justify-between gap-2 text-[11px] text-white/75"
                                    >
                                      <span>{formatTierRange(tier)}</span>
                                      <span className="flex items-center gap-1.5">
                                        <span
                                          className={
                                            tier.points < 0 ? "font-bold text-rose-300" : "font-bold text-emerald-300"
                                          }
                                        >
                                          {tier.points > 0 ? "+" : ""}
                                          {tier.points} pt{Math.abs(tier.points) > 1 ? "s" : ""}
                                        </span>
                                        {canConfig ? (
                                          <form action={deleteTier}>
                                            <input type="hidden" name="id" value={tier.id} />
                                            <button
                                              type="submit"
                                              className="text-rose-300/70 hover:text-rose-300"
                                              title="Supprimer ce palier"
                                            >
                                              ✕
                                            </button>
                                          </form>
                                        ) : null}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {canConfig ? (
                                <form
                                  action={createTier}
                                  className="mt-2 grid grid-cols-3 gap-1.5"
                                >
                                  <input type="hidden" name="conditionId" value={condition.id} />
                                  <input
                                    name="minValue"
                                    type="number"
                                    min={0}
                                    required
                                    placeholder="De"
                                    className="w-full px-2 py-1.5 text-xs"
                                  />
                                  <input
                                    name="maxValue"
                                    type="number"
                                    min={0}
                                    placeholder="À (vide=+)"
                                    className="w-full px-2 py-1.5 text-xs"
                                  />
                                  <input
                                    name="points"
                                    type="number"
                                    min={-1000}
                                    max={1000}
                                    required
                                    placeholder="Pts"
                                    className="w-full px-2 py-1.5 text-xs"
                                  />
                                  <button
                                    type="submit"
                                    className="neon-button-secondary col-span-3 px-2 py-1.5 text-[11px]"
                                  >
                                    Ajouter un palier
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          ) : null}

                          {canConfig ? (
                            <form action={deleteCondition} className="mt-2">
                              <input type="hidden" name="id" value={condition.id} />
                              <button
                                type="submit"
                                className="w-full rounded-lg border border-rose-400/20 px-2 py-1 text-[11px] font-semibold text-rose-300/80 transition hover:border-rose-400/40 hover:bg-rose-400/10"
                              >
                                Supprimer la condition
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {canConfig ? (
                    <form
                      action={createCondition}
                      className="mt-4 grid gap-2.5 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_auto]"
                    >
                      <input type="hidden" name="gameModeId" value={gameMode.id} />

                      <input
                        name="label"
                        type="text"
                        required
                        placeholder="Ex : Victoire, Kill, MVP..."
                        className="w-full px-3 py-2.5 text-sm"
                      />

                      <input
                        name="points"
                        type="number"
                        min={-1000}
                        max={1000}
                        placeholder="Points (peut être négatif)"
                        title="Ignoré si type = Paliers, définis les points palier par palier ensuite."
                        className="w-full px-3 py-2.5 text-sm"
                      />

                      <select name="mode" defaultValue="ONE_TIME" className="w-full px-3 py-2.5 text-sm">
                        <option value="ONE_TIME">Ponctuelle (case à cocher)</option>
                        <option value="QUANTITY">Quantité (nombre × points)</option>
                        <option value="TIERED">Paliers (tranches de valeurs)</option>
                      </select>

                      <select
                        name="appliesTo"
                        defaultValue="PLAYER"
                        className="w-full px-3 py-2.5 text-sm"
                      >
                        <option value="PLAYER">Joueur précis</option>
                        <option value="TEAM">Équipe entière</option>
                      </select>

                      <button type="submit" className="neon-button px-4 py-2.5 text-sm">
                        Ajouter
                      </button>
                    </form>
                  ) : null}

                  {canConfig ? (
                    <p className="neon-text-muted mt-2.5 text-[11px] leading-5">
                      Points négatifs autorisés (ex : Mort en Quantité avec -1 pt).
                      Pour une échelle du type « entre 5 et 9 kills = 10 pts », choisis
                      le type « Paliers » : la condition apparaît sans points propres,
                      ajoute ensuite chaque tranche (De / À / Points) juste en dessous.
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
