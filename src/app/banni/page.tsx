export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { submitBanAppeal } from "@/server/auth/submit-ban-appeal";
import { LogoutButton } from "@/components/layout/logout-button";

function getWarningTypeLabel(type: string | null) {
  switch (type) {
    case "TOXICITY":
      return "Toxicité";
    case "ABSENCE":
      return "Absence";
    case "AFK":
      return "AFK";
    case "INSULT":
      return "Insulte";
    case "CHEATING_SUSPECT":
      return "Suspicion de cheat";
    case "TEAM_REFUSAL":
      return "Refus d’équipe";
    case "SPAM":
      return "Spam";
    case "OTHER":
      return "Autre";
    default:
      return null;
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Explique ta situation en quelques mots (10 caractères minimum).";
    case "rate_limit":
      return "Tu as déjà envoyé plusieurs messages récemment. Un admin va y répondre, inutile d’en renvoyer.";
    case "server":
      return "Erreur serveur pendant l’envoi. Réessaie.";
    default:
      return null;
  }
}

export default async function BanniPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "BANNED") redirect("/acceuil");

  const ban = await db.ban.findFirst({
    where: { targetUserId: user.id, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
  });

  const existingAppeals = await db.contactRequest.count({
    where: { userId: user.id, subject: "Contestation de bannissement" },
  });

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const warningLabel = getWarningTypeLabel(ban?.triggerType ?? null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="neon-card p-6 md:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Compte banni
            </span>
          </div>

          <h1 className="neon-title text-2xl font-black text-white md:text-3xl">
            Ton compte a été banni
          </h1>

          <p className="neon-text-muted mt-4 text-sm leading-6 md:text-base md:leading-7">
            Tu ne peux plus accéder au site tant que ton bannissement n’est
            pas levé par un admin. Voici la raison, et tu peux t’expliquer
            juste en dessous — ta réponse part directement dans la boîte de
            contact des admins.
          </p>

          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300/80">
              Motif du bannissement
            </p>

            {ban ? (
              <>
                <p className="mt-2 text-sm leading-6 text-white md:text-base">
                  {ban.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
                  {warningLabel ? <span>Type : {warningLabel}</span> : null}
                  <span>Le {formatDate(ban.startedAt)}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm leading-6 text-white/70">
                Aucun détail supplémentaire n’est disponible pour ce
                bannissement.
              </p>
            )}
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-sm font-medium text-rose-300">{errorMessage}</p>
            </div>
          ) : null}

          {isSuccess ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm font-medium text-emerald-300">
                Ton message a bien été envoyé aux admins. Tu recevras une
                réponse dès qu’ils l’auront traité.
              </p>
            </div>
          ) : null}

          <form action={submitBanAppeal} className="mt-6 grid gap-3">
            <label className="block text-sm font-semibold text-white">
              T’expliquer auprès des admins
            </label>
            <textarea
              name="message"
              rows={6}
              required
              minLength={10}
              maxLength={3000}
              placeholder="Explique ta version des faits, les admins la liront pour décider de la suite..."
              className="w-full px-4 py-3"
            />
            <div>
              <button type="submit" className="neon-button px-4 py-2.5 md:px-6 md:py-3">
                Envoyer aux admins
              </button>
            </div>
          </form>

          {existingAppeals > 0 ? (
            <p className="neon-text-muted mt-4 text-xs">
              {existingAppeals} message{existingAppeals > 1 ? "s" : ""} déjà
              envoyé{existingAppeals > 1 ? "s" : ""} aux admins concernant ce
              bannissement.
            </p>
          ) : null}

          <div className="mt-8 border-t border-white/8 pt-5">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
