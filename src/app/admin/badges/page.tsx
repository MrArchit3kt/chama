export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createBadge } from "@/server/admin/create-badge";
import { deleteBadge } from "@/server/admin/delete-badge";
import { BADGE_ICONS, BADGE_COLORS, BADGE_CATEGORY_LABELS, getBadgeIcon, getBadgeColorClasses } from "@/lib/badges";

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Formulaire invalide. Vérifie les champs (le code n’accepte que MAJUSCULES, chiffres et _).";
    case "code_taken":
      return "Ce code de badge existe déjà.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function AdminBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; deleted?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isDeleted = sp.deleted === "1";

  const badges = await db.badge.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true } } },
  });

  return (
    <SiteShell>
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Badges (Admin)
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Catalogue de badges
          </h1>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Crée des badges ici, puis attribue-les aux joueurs depuis{" "}
            <span className="text-white">Admin Players</span> (détail d’un
            joueur → section Badges).
          </p>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}
        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">Badge créé avec succès.</p>
          </div>
        ) : null}
        {isDeleted ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">Badge supprimé.</p>
          </div>
        ) : null}

        {/* CREATION */}
        <div className="neon-card p-6 md:p-8">
          <h2 className="text-lg font-bold text-white">Nouveau badge</h2>

          <form action={createBadge} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Code (unique)
              </label>
              <input
                name="code"
                type="text"
                required
                placeholder="TOP_FRAGGER"
                className="w-full px-4 py-3 uppercase"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Nom affiché</label>
              <input
                name="name"
                type="text"
                required
                placeholder="Top Fragger"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-white">Description</label>
              <textarea
                name="description"
                rows={2}
                required
                placeholder="Le joueur avec le plus d’éliminations du mois."
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Catégorie</label>
              <select name="category" defaultValue="SKILL" className="w-full px-4 py-3">
                {Object.entries(BADGE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Icône</label>
              <select name="icon" defaultValue="trophy" className="w-full px-4 py-3">
                {BADGE_ICONS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Couleur</label>
              <select name="color" defaultValue="cyan" className="w-full px-4 py-3">
                {BADGE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="neon-button px-6 py-3">
                Créer le badge
              </button>
            </div>
          </form>
        </div>

        {/* CATALOGUE */}
        <div className="neon-card p-6 md:p-8">
          <h2 className="text-lg font-bold text-white">
            Badges existants ({badges.length})
          </h2>

          {badges.length === 0 ? (
            <p className="neon-text-muted mt-4 text-sm">Aucun badge créé pour le moment.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge) => {
                const Icon = getBadgeIcon(badge.icon);
                const colorClasses = getBadgeColorClasses(badge.color);

                return (
                  <div key={badge.id} className="neon-card-soft p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${colorClasses}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="neon-badge text-[10px]">
                        {badge._count.users} joueur{badge._count.users > 1 ? "s" : ""}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-white">{badge.name}</h3>
                    <p className="neon-text-muted mt-1 text-[11px] uppercase tracking-[0.14em]">
                      {BADGE_CATEGORY_LABELS[badge.category] ?? badge.category}
                    </p>
                    <p className="neon-text-muted mt-2 text-xs leading-5">{badge.description}</p>

                    <form action={deleteBadge} className="mt-3">
                      <input type="hidden" name="id" value={badge.id} />
                      <button type="submit" className="neon-button-secondary w-full px-3 py-2 text-xs">
                        Supprimer
                      </button>
                    </form>
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
