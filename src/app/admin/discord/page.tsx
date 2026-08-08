export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createDiscordVoiceChannel } from "@/server/admin/create-discord-voice-channel";
import { deleteDiscordVoiceChannel } from "@/server/admin/delete-discord-voice-channel";
import { isDiscordBotConfigured, isDiscordOAuthConfigured } from "@/lib/discord";

const GAMES = [
  { value: "WARZONE", label: "Warzone" },
  { value: "WARZONE_RANKED", label: "Ranked" },
  { value: "BO7", label: "BO7" },
  { value: "ROCKET_LEAGUE", label: "Rocket League" },
] as const;

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Formulaire invalide. L’ID de salon Discord doit être un nombre (clic droit sur le salon → Copier l’ID, mode développeur Discord activé).";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function AdminDiscordPage({
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

  const oauthConfigured = isDiscordOAuthConfigured();
  const botConfigured = isDiscordBotConfigured();

  const channels = await db.discordVoiceChannel.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300/75">
            Discord (Admin)
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Salons vocaux &amp; déplacement automatique
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Configure ici, pour chaque jeu, les salons vocaux Discord dans
            l’ordre (1er ajouté = Équipe 1, 2ème = Équipe 2, etc). Dès qu’un
            mix est généré, chaque joueur ayant connecté son Discord (depuis
            son Profil) et déjà présent dans un vocal du serveur est déplacé
            automatiquement dans le bon salon.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className={
                oauthConfigured
                  ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                  : "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"
              }
            >
              Connexion Discord {oauthConfigured ? "activée" : "non configurée"}
            </span>
            <span
              className={
                botConfigured
                  ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                  : "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"
              }
            >
              Bot Discord {botConfigured ? "activé" : "non configuré"}
            </span>
          </div>

          {!oauthConfigured || !botConfigured ? (
            <p className="neon-text-muted mt-3 text-xs leading-5">
              Variables d’env manquantes : {!oauthConfigured ? "DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET " : ""}
              {!botConfigured ? "DISCORD_BOT_TOKEN / DISCORD_GUILD_ID" : ""}
            </p>
          ) : null}

          <p className="neon-text-muted mt-3 text-xs leading-5">
            ⚠️ Un bot Discord ne peut déplacer que des joueurs déjà connectés
            à un salon vocal du serveur — il ne peut pas les faire rejoindre
            depuis rien.
          </p>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}
        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">Salon vocal ajouté avec succès.</p>
          </div>
        ) : null}
        {isDeleted ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">Salon vocal supprimé.</p>
          </div>
        ) : null}

        <div className="neon-card p-6 md:p-8">
          <h2 className="text-lg font-bold text-white">Ajouter un salon vocal</h2>

          <form
            action={createDiscordVoiceChannel}
            className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <select name="game" defaultValue="WARZONE" className="w-full px-4 py-3">
              {GAMES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>

            <input
              name="label"
              type="text"
              required
              placeholder="Ex : Équipe 1"
              className="w-full px-4 py-3"
            />

            <input
              name="channelId"
              type="text"
              required
              inputMode="numeric"
              placeholder="ID du salon Discord"
              className="w-full px-4 py-3"
            />

            <button type="submit" className="neon-button px-5 py-3">
              Ajouter
            </button>
          </form>

          <p className="neon-text-muted mt-3 text-xs leading-5">
            Pour récupérer un ID de salon : Réglages utilisateur Discord →
            Avancés → activer le Mode développeur, puis clic droit sur le
            salon vocal → Copier l’identifiant du salon.
          </p>
        </div>

        {GAMES.map((g) => {
          const gameChannels = channels.filter((c) => c.game === g.value);

          return (
            <div key={g.value} className="neon-card p-6 md:p-8">
              <h2 className="text-lg font-bold text-white">{g.label}</h2>

              {gameChannels.length === 0 ? (
                <p className="neon-text-muted mt-3 text-sm">
                  Aucun salon vocal configuré pour ce jeu.
                </p>
              ) : (
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {gameChannels.map((channel, index) => (
                    <div key={channel.id} className="neon-card-soft flex items-center justify-between gap-3 p-3.5">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300/80">
                          Équipe {index + 1}
                        </p>
                        <p className="truncate text-sm font-semibold text-white">{channel.label}</p>
                        <p className="neon-text-muted truncate text-[11px]">{channel.channelId}</p>
                      </div>

                      <form action={deleteDiscordVoiceChannel}>
                        <input type="hidden" name="id" value={channel.id} />
                        <button
                          type="submit"
                          className="neon-button-secondary shrink-0 px-3 py-2 text-xs"
                        >
                          Retirer
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SiteShell>
  );
}
