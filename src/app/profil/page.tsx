export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { updateProfile } from "@/server/profil/update-profile";
import { updatePassword } from "@/server/profil/update-password";
import { getBadgeIcon, getBadgeColorClasses } from "@/lib/badges";

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Le formulaire est invalide. Vérifie les champs.";
    case "server":
      return "Erreur serveur pendant l’action demandée. Réessaie.";
    case "banned":
      return "Compte banni. Action impossible.";
    case "email_taken":
      return "Cet email est déjà utilisé par un autre compte.";
    case "password_validation":
      return "Mot de passe invalide (minimum 6 caractères, confirmation identique).";
    case "password_mismatch":
      return "Le mot de passe actuel est incorrect.";
    default:
      return null;
  }
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; password_success?: string }>;
}) {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      badges: {
        orderBy: { earnedAt: "desc" },
        select: { badge: { select: { id: true, name: true, description: true, icon: true, color: true } } },
      },
    },
  });
  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isPasswordSuccess = sp.password_success === "1";

  return (
    <SiteShell>
      <div className="grid gap-6">
        {/* HEADER */}
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Profil
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Mon profil joueur
          </h2>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Consulte et modifie tes informations : nom, email, mot de passe et
            infos de jeu. Pour rejoindre une file de mix et voir les équipes,
            rends-toi sur l’onglet du jeu concerné.
          </p>
        </div>

        {/* FEEDBACK */}
        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">
              Profil mis à jour avec succès.
            </p>
          </div>
        ) : null}

        {isPasswordSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">
              Mot de passe mis à jour avec succès.
            </p>
          </div>
        ) : null}

        {/* ===================== */}
        {/* BADGES */}
        {/* ===================== */}
        {user.badges.length > 0 ? (
          <div className="neon-card p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
              Récompenses
            </p>
            <h3 className="mt-2 text-xl font-bold text-white">Mes badges</h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {user.badges.map(({ badge }) => {
                const Icon = getBadgeIcon(badge.icon);
                const colorClasses = getBadgeColorClasses(badge.color);

                return (
                  <span
                    key={badge.id}
                    title={badge.description}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${colorClasses}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {badge.name}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ===================== */}
        {/* INFOS JOUEUR */}
        {/* ===================== */}
        <div className="neon-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Informations
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">Mes informations joueur</h3>
          <p className="neon-text-muted mt-2 text-sm">
            Nom, email et infos de jeu utilisées pour te reconnaître et te
            contacter.
          </p>

          <form action={updateProfile} className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nom affiché
              </label>
              <input
                name="displayName"
                type="text"
                required
                defaultValue={user.displayName}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Pseudo Warzone
              </label>
              <input
                name="warzoneUsername"
                type="text"
                required
                defaultValue={user.warzoneUsername}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Activision ID
              </label>
              <input
                name="activisionId"
                type="text"
                defaultValue={user.activisionId ?? ""}
                placeholder="Pseudo#1234567"
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Plateforme
              </label>
              <select
                name="platform"
                defaultValue={user.platform ?? ""}
                className="w-full px-4 py-3"
              >
                <option value="">Choisir</option>
                <option value="PC">PC</option>
                <option value="PS5">PS5</option>
                <option value="PS4">PS4</option>
                <option value="XBOX_SERIES">Xbox Series</option>
                <option value="XBOX_ONE">Xbox One</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Rôle préféré (Warzone / BO7)
              </label>
              <select
                name="preferredRole"
                defaultValue={user.preferredRole ?? "NONE"}
                className="w-full px-4 py-3"
              >
                <option value="NONE">Aucun</option>
                <option value="RUSH">Rush</option>
                <option value="SUPPORT">Support</option>
                <option value="SNIPE">Snipe</option>
                <option value="FLEX">Flex</option>
                <option value="IGL">IGL</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Rang Rocket League
              </label>
              <select
                name="rocketLeagueRank"
                defaultValue={user.rocketLeagueRank ?? ""}
                className="w-full px-4 py-3"
              >
                <option value="">Non renseigné</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Argent</option>
                <option value="GOLD">Or</option>
                <option value="PLATINUM">Platine</option>
                <option value="DIAMOND">Diamant</option>
                <option value="CHAMPION">Champion</option>
                <option value="GRAND_CHAMPION">Grand Champion</option>
                <option value="SSL">SSL</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Rang Warzone Ranked
              </label>
              <select
                name="warzoneRankTier"
                defaultValue={user.warzoneRankTier ?? ""}
                className="w-full px-4 py-3"
              >
                <option value="">Non renseigné</option>
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Argent</option>
                <option value="GOLD">Or</option>
                <option value="PLATINUM">Platine</option>
                <option value="DIAMOND">Diamant</option>
                <option value="CRIMSON">Cramoisi</option>
                <option value="IRIDESCENT">Irisé</option>
                <option value="TOP_250">Top 250</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Discord
              </label>
              <input
                name="discordUsername"
                type="text"
                defaultValue={user.discordUsername ?? ""}
                placeholder="pseudo_discord"
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                WhatsApp
              </label>
              <input
                name="whatsappNumber"
                type="text"
                defaultValue={user.whatsappNumber ?? ""}
                placeholder="+33600000000"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="micAvailable"
                  type="checkbox"
                  defaultChecked={user.micAvailable}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Micro disponible</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="whatsappOptIn"
                  type="checkbox"
                  defaultChecked={user.whatsappOptIn}
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">
                  J’accepte les notifications WhatsApp
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="neon-button w-full px-4 py-3">
                Enregistrer les modifications
              </button>
            </div>
          </form>
        </div>

        {/* ===================== */}
        {/* MOT DE PASSE */}
        {/* ===================== */}
        <div className="neon-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Sécurité
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">Changer mon mot de passe</h3>
          <p className="neon-text-muted mt-2 text-sm">
            Saisis ton mot de passe actuel puis le nouveau (minimum 6 caractères).
          </p>

          <form action={updatePassword} className="mt-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Mot de passe actuel
              </label>
              <input
                name="currentPassword"
                type="password"
                required
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Nouveau mot de passe
              </label>
              <input
                name="newPassword"
                type="password"
                required
                minLength={6}
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Confirmer le nouveau mot de passe
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-3">
              <button type="submit" className="neon-button-secondary w-full px-4 py-3">
                Mettre à jour le mot de passe
              </button>
            </div>
          </form>
        </div>
      </div>
    </SiteShell>
  );
}
