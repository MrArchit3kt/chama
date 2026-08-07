export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { saveRules } from "@/server/rules/save-rules";

export default async function AdminReglementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const hasValidationError = sp.error === "validation";
  const hasServerError = sp.error === "server";
  const isSuccess = sp.success === "1";

  const activeRules = await db.rulesVersion.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      id: true,
      title: true,
      content: true,
      versionNumber: true,
      updatedAt: true,
    },
  });

  const latestRules = await db.rulesVersion.findMany({
    orderBy: {
      versionNumber: "desc",
    },
    take: 5,
    select: {
      id: true,
      title: true,
      versionNumber: true,
      isActive: true,
      publishedAt: true,
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Admin Règlement
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Gestion du règlement
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Rédige ou mets à jour le règlement officiel de la communauté.
            Chaque sauvegarde crée une nouvelle version.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="neon-card p-5 md:p-8">
            <h2 className="text-xl font-bold text-white md:text-2xl">
              {activeRules ? "Modifier le règlement" : "Créer le règlement"}
            </h2>

            <form action={saveRules} className="mt-6 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Titre
                </label>
                <input
                  name="title"
                  type="text"
                  defaultValue={activeRules?.title ?? "Règlement officiel CHAMA"}
                  className="w-full px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Contenu du règlement
                </label>
                <textarea
                  name="content"
                  rows={18}
                  defaultValue={activeRules?.content ?? ""}
                  className="w-full px-4 py-3"
                  placeholder="Écris ici le règlement complet..."
                  required
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="makeActive"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">
                  Définir cette version comme règlement actif
                </span>
              </label>

              {hasValidationError ? (
                <p className="text-sm font-medium text-rose-400">
                  Formulaire invalide. Vérifie les champs.
                </p>
              ) : null}

              {hasServerError ? (
                <p className="text-sm font-medium text-rose-400">
                  Erreur serveur pendant la sauvegarde.
                </p>
              ) : null}

              {isSuccess ? (
                <p className="text-sm font-medium text-emerald-400">
                  Nouvelle version du règlement enregistrée avec succès.
                </p>
              ) : null}

              <div>
                <button type="submit" className="neon-button px-4 py-2.5 md:px-6 md:py-3">
                  Enregistrer le règlement
                </button>
              </div>
            </form>
          </div>

          <div className="grid gap-4 md:gap-6">
            <div className="neon-card p-4 md:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Version active
              </p>

              {activeRules ? (
                <>
                  <h3 className="mt-3 text-xl font-bold text-white">
                    V{activeRules.versionNumber} — {activeRules.title}
                  </h3>
                  <p className="neon-text-muted mt-3 text-sm">
                    Dernière mise à jour :{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(activeRules.updatedAt)}
                  </p>
                </>
              ) : (
                <p className="neon-text-muted mt-3 text-sm">
                  Aucun règlement actif pour le moment.
                </p>
              )}
            </div>

            <div className="neon-card p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                Historique
              </p>

              <div className="mt-4 grid gap-3">
                {latestRules.length === 0 ? (
                  <p className="neon-text-muted text-sm">
                    Aucune version enregistrée.
                  </p>
                ) : (
                  latestRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] p-4"
                    >
                      <p className="font-semibold text-white">
                        V{rule.versionNumber} — {rule.title}
                      </p>
                      <p className="neon-text-muted mt-2 text-sm">
                        {rule.isActive ? "Version active" : "Version archivée"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}