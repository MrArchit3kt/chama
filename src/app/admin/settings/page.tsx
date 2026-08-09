export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { saveSiteConfig } from "@/server/admin/save-site-config";

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Le formulaire est invalide. Vérifie les champs obligatoires.";
    case "server":
      return "Erreur serveur pendant la sauvegarde.";
    default:
      return null;
  }
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const config = await db.siteConfig.findUnique({
    where: { id: "main" },
  });

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Admin Settings
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Configuration globale du site
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Gère les liens publics, le contenu d’accueil et les options générales
            sans repasser par le code.
          </p>
        </div>

        <div className="neon-card p-5 md:p-8">
          <form action={saveSiteConfig} className="grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nom du site
              </label>
              <input
                name="siteName"
                type="text"
                required
                defaultValue={config?.siteName ?? "CHAMA Squad Manager"}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Titre d’accueil
              </label>
              <input
                name="homeHeadline"
                type="text"
                required
                defaultValue={config?.homeHeadline ?? "CHAMA Warzone Squad"}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Description d’accueil
              </label>
              <textarea
                name="homeDescription"
                rows={5}
                required
                defaultValue={
                  config?.homeDescription ??
                  "Plateforme de gestion de team, mix automatique, événements, modération et organisation complète de la communauté."
                }
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Image hero d’accueil (URL ou chemin public)
              </label>
              <input
                name="homeHeroImageUrl"
                type="text"
                defaultValue={config?.homeHeroImageUrl ?? "/images/CHAMA-hero.jpg"}
                placeholder="/images/CHAMA-hero.jpg"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Lien Discord
                </label>
                <input
                  name="discordInviteUrl"
                  type="text"
                  defaultValue={config?.discordInviteUrl ?? ""}
                  placeholder="https://discord.gg/..."
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Lien WhatsApp
                </label>
                <input
                  name="whatsappInviteUrl"
                  type="text"
                  defaultValue={config?.whatsappInviteUrl ?? ""}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Thème événementiel du site
              </label>
              <p className="neon-text-muted mb-3 text-xs">
                Affiche une décoration animée sur toutes les pages (neige,
                étoile filante, sapin...). Visible par tous les joueurs
                immédiatement après enregistrement.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/2 p-4 transition has-checked:border-cyan-400/40 has-checked:bg-cyan-400/6">
                  <input
                    type="radio"
                    name="theme"
                    value="DEFAULT"
                    defaultChecked={config?.theme !== "CHRISTMAS"}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-white">Aucun</span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/2 p-4 transition has-checked:border-emerald-400/40 has-checked:bg-emerald-400/6">
                  <input
                    type="radio"
                    name="theme"
                    value="CHRISTMAS"
                    defaultChecked={config?.theme === "CHRISTMAS"}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-white">🎄 Noël</span>
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="socialsEnabled"
                  type="checkbox"
                  defaultChecked={config?.socialsEnabled ?? true}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Réseaux activés</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="eventsEnabled"
                  type="checkbox"
                  defaultChecked={config?.eventsEnabled ?? true}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Événements activés</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="contactEnabled"
                  type="checkbox"
                  defaultChecked={config?.contactEnabled ?? true}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Contact activé</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="registrationsEnabled"
                  type="checkbox"
                  defaultChecked={config?.registrationsEnabled ?? true}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Inscriptions activées</span>
              </label>
            </div>

            {errorMessage ? (
              <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
            ) : null}

            {isSuccess ? (
              <p className="text-sm font-medium text-emerald-400">
                Configuration enregistrée avec succès.
              </p>
            ) : null}

            <div>
              <button type="submit" className="neon-button px-4 py-2.5 md:px-6 md:py-3">
                Enregistrer la configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </SiteShell>
  );
}