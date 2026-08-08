export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { createEvent } from "@/server/events/create-event";
import { updateEvent } from "@/server/events/update-event";
import { deleteEvent } from "@/server/events/delete-event";
import { EventRosterModal } from "@/components/admin/event-roster-modal";

function formatDateForInput(value: Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getEventStatusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "PUBLISHED":
      return "Publié";
    case "LIVE":
      return "En cours";
    case "COMPLETED":
      return "Terminé";
    case "CANCELLED":
      return "Annulé";
    default:
      return status;
  }
}

function getPresenceLabel(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "Présent";
    case "CANCELLED":
      return "Absent";
    case "REGISTERED":
      return "Inscrit";
    case "NO_SHOW":
      return "Absent non prévenu";
    default:
      return status;
  }
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Formulaire invalide. Vérifie les champs, les dates et les informations saisies.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    case "image_type":
      return "Format d’image invalide. Utilise uniquement PNG, JPG ou WEBP.";
    case "image_size":
      return "Image trop lourde. Taille maximale autorisée : 5 Mo.";
    case "image_url":
      return "URL d’image invalide. Utilise une URL http/https valide.";
    case "not_found":
      return "Événement introuvable.";
    default:
      return null;
  }
}

function isAbsoluteHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getEventImageSrc(imageUrl?: string | null) {
  if (!imageUrl) return null;

  const value = imageUrl.trim();
  if (!value) return null;

  if (value.startsWith("/")) return value;
  if (isAbsoluteHttpUrl(value)) return value;

  return null;
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    updated?: string;
    deleted?: string;
    roster_updated?: string;
  }>;
}) {
  const user = await requireAdmin();

  if (!user) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";
  const isUpdated = sp.updated === "1";
  const isDeleted = sp.deleted === "1";
  const isRosterUpdated = sp.roster_updated === "1";

  const [events, rosterCandidates] = await Promise.all([
    db.event.findMany({
      orderBy: {
        eventDate: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        endDate: true,
        status: true,
        coverImageUrl: true,
        publishInApp: true,
        publishToDiscord: true,
        publishToWhatsApp: true,
        isPublished: true,
        createdAt: true,
        participants: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            userId: true,
            status: true,
            rosterRole: true,
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                warzoneUsername: true,
                platform: true,
              },
            },
          },
        },
      },
    }),
    db.user.findMany({
      where: { status: "ACTIVE", registrationStatus: "APPROVED" },
      select: { id: true, displayName: true, username: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Admin Events
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Gestion des événements
          </h2>
          <p className="neon-text-muted mt-4 max-w-2xl leading-7">
            Crée, modifie, illustre et supprime les événements de la communauté.
          </p>
        </div>

        <div className="neon-card p-5 md:p-8">
          <h3 className="text-xl font-bold text-white md:text-2xl">Créer un événement</h3>

          <form
            action={createEvent}
            encType="multipart/form-data"
            className="mt-6 grid gap-4"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Titre
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="Tournoi du samedi"
                className="w-full px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white">
                Description
              </label>
              <textarea
                name="description"
                required
                rows={6}
                placeholder="Décris l’événement, les règles et les infos utiles..."
                className="w-full px-4 py-3"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Image par URL (optionnel)
                </label>
                <input
                  name="coverImageUrl"
                  type="text"
                  placeholder="https://..."
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Image par upload (optionnel)
                </label>
                <input
                  name="coverImageFile"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="w-full px-4 py-3"
                />
                <p className="mt-2 text-xs text-white/60">
                  Formats acceptés : PNG, JPG, WEBP • max 5 Mo
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Date et heure de début
                </label>
                <input
                  name="eventDate"
                  type="datetime-local"
                  required
                  className="w-full px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Date et heure de fin (optionnel)
                </label>
                <input
                  name="endDate"
                  type="datetime-local"
                  className="w-full px-4 py-3"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="publishInApp"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Notifier dans le site</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="publishToDiscord"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Préparer Discord</span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <input
                  name="publishToWhatsApp"
                  type="checkbox"
                  className="h-4 w-4"
                />
                <span className="text-sm text-white">Préparer WhatsApp</span>
              </label>
            </div>

            {errorMessage ? (
              <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
            ) : null}

            {isSuccess ? (
              <p className="text-sm font-medium text-emerald-400">
                Événement créé avec succès.
              </p>
            ) : null}

            {isUpdated ? (
              <p className="text-sm font-medium text-emerald-400">
                Événement modifié avec succès.
              </p>
            ) : null}

            {isDeleted ? (
              <p className="text-sm font-medium text-amber-300">
                Événement supprimé avec succès.
              </p>
            ) : null}

            {isRosterUpdated ? (
              <p className="text-sm font-medium text-emerald-400">
                Composition de l’équipe mise à jour avec succès.
              </p>
            ) : null}

            <div>
              <button type="submit" className="neon-button px-4 py-2.5 md:px-6 md:py-3">
                Publier l’événement
              </button>
            </div>
          </form>
        </div>

        <div className="grid gap-4 md:gap-6">
          {events.length === 0 ? (
            <div className="neon-card p-5 md:p-8">
              <p className="neon-text-muted text-sm">
                Aucun événement créé pour le moment.
              </p>
            </div>
          ) : (
            events.map((event) => {
              const confirmedCount = event.participants.filter(
                (participant) => participant.status === "CONFIRMED",
              ).length;

              const cancelledCount = event.participants.filter(
                (participant) => participant.status === "CANCELLED",
              ).length;

              const titulaires = event.participants.filter(
                (participant) => participant.rosterRole === "TITULAIRE",
              );
              const remplacants = event.participants.filter(
                (participant) => participant.rosterRole === "REMPLACANT",
              );

              const imageSrc = getEventImageSrc(event.coverImageUrl);

              return (
                <div key={event.id} className="neon-card p-4 md:p-8">
                  <div className="flex flex-col gap-4 md:gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 md:gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                          Événement existant
                        </p>
                        <h3 className="mt-2 text-lg font-bold text-white md:text-2xl">
                          {event.title}
                        </h3>
                        <p className="neon-text-muted mt-2 text-sm">
                          Début : {formatDate(event.eventDate)}
                        </p>
                        {event.endDate ? (
                          <p className="neon-text-muted mt-1 text-sm">
                            Fin : {formatDate(event.endDate)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        <span className="neon-badge">
                          {getEventStatusLabel(event.status)}
                        </span>
                        <span className="neon-badge">
                          {event.isPublished ? "Publié" : "Non publié"}
                        </span>
                      </div>
                    </div>

                    {imageSrc ? (
                      <div className="rounded-2xl border border-white/8 bg-black/30 p-3 md:p-6">
                        <div className="flex justify-center overflow-auto rounded-2xl border border-white/8 bg-black/20 p-2 md:p-4">
                          <img
                            src={imageSrc}
                            alt={event.title}
                            className="block h-auto max-h-72 w-auto max-w-full rounded-xl md:max-h-168"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-amber-400/15 bg-amber-400/4 p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
                          Composition de l’équipe
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <EventRosterModal
                            eventId={event.id}
                            role="TITULAIRE"
                            label="Titulaires"
                            candidates={rosterCandidates}
                            selectedIds={titulaires.map((p) => p.userId)}
                            accentClassName="border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                          />
                          <EventRosterModal
                            eventId={event.id}
                            role="REMPLACANT"
                            label="Remplaçants"
                            candidates={rosterCandidates}
                            selectedIds={remplacants.map((p) => p.userId)}
                            accentClassName="border-amber-400/25 bg-amber-400/10 text-amber-300"
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                            Titulaires ({titulaires.length})
                          </p>
                          {titulaires.length === 0 ? (
                            <p className="neon-text-muted mt-2 text-xs">Aucun titulaire désigné.</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {titulaires.map((p) => (
                                <span key={p.id} className="neon-badge text-[10px]">
                                  {p.user.displayName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                            Remplaçants ({remplacants.length})
                          </p>
                          {remplacants.length === 0 ? (
                            <p className="neon-text-muted mt-2 text-xs">Aucun remplaçant désigné.</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {remplacants.map((p) => (
                                <span key={p.id} className="neon-badge text-[10px]">
                                  {p.user.displayName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
                          Réponses des joueurs
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <span className="neon-badge">
                            {confirmedCount} présent
                            {confirmedCount > 1 ? "s" : ""}
                          </span>
                          <span className="neon-badge">
                            {cancelledCount} absent
                            {cancelledCount > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {event.participants.length === 0 ? (
                        <div className="mt-4">
                          <p className="neon-text-muted text-sm">
                            Aucun retour pour cet événement.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {event.participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="rounded-2xl border border-white/8 bg-black/20 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-white">
                                    {participant.user.displayName}
                                  </p>
                                  <p className="neon-text-muted mt-1 text-sm">
                                    @{participant.user.username}
                                  </p>
                                </div>

                                <span
                                  className={
                                    participant.status === "CONFIRMED"
                                      ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                                      : participant.status === "CANCELLED"
                                      ? "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"
                                      : "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/70"
                                  }
                                >
                                  {getPresenceLabel(participant.status)}
                                </span>
                              </div>

                              <p className="neon-text-muted mt-3 text-sm">
                                Warzone :{" "}
                                <span className="text-white">
                                  {participant.user.warzoneUsername}
                                </span>
                              </p>
                              <p className="neon-text-muted mt-1 text-sm">
                                Plateforme :{" "}
                                <span className="text-white">
                                  {participant.user.platform ?? "Non renseignée"}
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <form
                      action={updateEvent}
                      encType="multipart/form-data"
                      className="grid gap-4"
                    >
                      <input type="hidden" name="id" value={event.id} />

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Titre
                        </label>
                        <input
                          name="title"
                          defaultValue={event.title}
                          className="w-full px-4 py-3"
                          required
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Description
                        </label>
                        <textarea
                          name="description"
                          defaultValue={event.description}
                          rows={5}
                          className="w-full px-4 py-3"
                          required
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Image par URL
                          </label>
                          <input
                            name="coverImageUrl"
                            defaultValue={event.coverImageUrl ?? ""}
                            className="w-full px-4 py-3"
                            placeholder="https://..."
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Remplacer par upload
                          </label>
                          <input
                            name="coverImageFile"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="w-full px-4 py-3"
                          />
                          <p className="mt-2 text-xs text-white/60">
                            Formats acceptés : PNG, JPG, WEBP • max 5 Mo
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Début
                          </label>
                          <input
                            name="eventDate"
                            type="datetime-local"
                            defaultValue={formatDateForInput(event.eventDate)}
                            className="w-full px-4 py-3"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-white">
                            Fin
                          </label>
                          <input
                            name="endDate"
                            type="datetime-local"
                            defaultValue={formatDateForInput(event.endDate)}
                            className="w-full px-4 py-3"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white">
                          Statut
                        </label>
                        <select
                          name="status"
                          defaultValue={event.status}
                          className="w-full px-4 py-3"
                        >
                          <option value="DRAFT">Brouillon</option>
                          <option value="PUBLISHED">Publié</option>
                          <option value="LIVE">En cours</option>
                          <option value="COMPLETED">Terminé</option>
                          <option value="CANCELLED">Annulé</option>
                        </select>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <input
                            name="publishInApp"
                            type="checkbox"
                            defaultChecked={event.publishInApp}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-white">
                            Notifier dans le site
                          </span>
                        </label>

                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <input
                            name="publishToDiscord"
                            type="checkbox"
                            defaultChecked={event.publishToDiscord}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-white">
                            Préparer Discord
                          </span>
                        </label>

                        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <input
                            name="publishToWhatsApp"
                            type="checkbox"
                            defaultChecked={event.publishToWhatsApp}
                            className="h-4 w-4"
                          />
                          <span className="text-sm text-white">
                            Préparer WhatsApp
                          </span>
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button type="submit" className="neon-button px-4 py-2.5 md:px-6 md:py-3">
                          Modifier l’événement
                        </button>
                      </div>
                    </form>

                    <form action={deleteEvent}>
                      <input type="hidden" name="id" value={event.id} />
                      <button
                        type="submit"
                        className="neon-button-secondary px-4 py-2.5 md:px-6 md:py-3"
                      >
                        Supprimer l’événement
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SiteShell>
  );
}