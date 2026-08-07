export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { registerUser } from "@/server/auth/register";

function getErrorMessage(error?: string) {
  switch (error) {
    case "email":
      return "Un compte existe déjà avec cet email.";
    case "validation":
      return "Le formulaire est invalide. Vérifie les champs.";
    case "server":
      return "Erreur serveur pendant la création du compte. Réessaie.";
    case "rate_limit":
      return "Trop de tentatives d’inscription. Réessaie dans un moment.";
    default:
      return null;
  }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/profil");

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="neon-card p-7 md:p-8">
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="neon-badge">Inscription</span>
            </div>

            <h1 className="neon-title neon-gradient-text text-3xl font-black">
              Créer un compte
            </h1>

            <p className="neon-text-muted mt-3 text-sm leading-6">
              Rejoins la communauté privée et prépare ton profil joueur.
            </p>
          </div>

          <form action={registerUser} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-white">
                Nom affiché
              </label>
              <input
                name="displayName"
                type="text"
                required
                placeholder="Pénélope"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-white">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="ton@email.com"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-white">
                Activision ID (optionnel)
              </label>
              <input
                name="activisionId"
                type="text"
                placeholder="Pseudo#1234567"
                className="w-full px-4 py-3"
              />
              <p className="neon-text-muted mt-2 text-xs leading-5">
                Si tu ne le mets pas maintenant, on utilisera ton nom affiché comme pseudo Warzone par défaut (modifiable ensuite).
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Mot de passe
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 caractères"
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Confirmer le mot de passe
              </label>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                placeholder="Confirme le mot de passe"
                className="w-full px-4 py-3"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="acceptRules"
                  type="checkbox"
                  required
                  className="mt-1 h-4 w-4"
                />
                <span className="neon-text-muted text-sm leading-6">
                  J’ai lu et j’accepte le règlement de la communauté.
                </span>
              </label>
            </div>

            {errorMessage ? (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <button type="submit" className="neon-button w-full px-4 py-3">
                Créer mon compte
              </button>
            </div>
          </form>

          <p className="neon-text-muted mt-5 text-sm">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-cyan-300">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}