export const dynamic = "force-dynamic";

import { SiteShell } from "@/components/layout/site-shell";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { setEventPresence } from "@/server/events/set-event-presence";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getStatusLabel(status: string) {
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

function isAbsoluteHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getEventImageSrc(imageUrl?: string | null) {
  if (!imageUrl) {
    return null;
  }

  const value = imageUrl.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  if (isAbsoluteHttpUrl(value)) {
    return value;
  }

  return null;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sessionUser = await requireAuth();
  const sp = (await searchParams) ?? {};
  const hasError = sp.error === "server";
  const isSuccess = sp.success === "1";

  const events = await db.event.findMany({
    where: {
      isPublished: true,
    },
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
      participants: {
        where: {
          userId: sessionUser?.id ?? "__no_user__",
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Events
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Événements de la communauté
          </h1>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Tous les événements publiés de la team CHAMA.
          </p>
        </div>

        {hasError ? (
          <div className="neon-card p-6">
            <p className="text-sm font-medium text-rose-400">
              Erreur serveur pendant l’enregistrement de ta réponse.
            </p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-6">
            <p className="text-sm font-medium text-emerald-400">
              Ta réponse a bien été enregistrée.
            </p>
          </div>
        ) : null}

        {events.length === 0 ? (
          <div className="neon-card p-8">
            <p className="neon-text-muted text-sm">
              Aucun événement publié pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map((event) => {
              const myParticipation = event.participants[0] ?? null;
              const imageSrc = getEventImageSrc(event.coverImageUrl);

              return (
                <div key={event.id} className="neon-card overflow-hidden p-0">
                  {imageSrc ? (
                    <div className="border-b border-white/8 bg-black/30 p-4 md:p-6">
                      <div className="overflow-hidden rounded-2xl border border-white/8 bg-black/40">
                        <img
                          src={imageSrc}
                          alt={event.title}
                          className="block h-auto max-h-[700px] w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="p-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold text-white">
                          {event.title}
                        </h2>
                        <p className="neon-text-muted mt-2 text-sm">
                          Début : {formatDate(event.eventDate)}
                        </p>
                        {event.endDate ? (
                          <p className="neon-text-muted mt-1 text-sm">
                            Fin : {formatDate(event.endDate)}
                          </p>
                        ) : null}
                      </div>

                      <span className="neon-badge">
                        {getStatusLabel(event.status)}
                      </span>
                    </div>

                    <p className="neon-text-muted mt-5 whitespace-pre-wrap leading-7">
                      {event.description}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <form action={setEventPresence}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="action" value="present" />
                        <button type="submit" className="neon-button px-5 py-3">
                          Je serai présent
                        </button>
                      </form>

                      <form action={setEventPresence}>
                        <input type="hidden" name="eventId" value={event.id} />
                        <input type="hidden" name="action" value="absent" />
                        <button
                          type="submit"
                          className="neon-button-secondary px-5 py-3"
                        >
                          Je ne serai pas présent
                        </button>
                      </form>
                    </div>

                    <div className="mt-4">
                      {myParticipation?.status === "CONFIRMED" ? (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                          Tu es marqué présent
                        </span>
                      ) : null}

                      {myParticipation?.status === "CANCELLED" ? (
                        <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300">
                          Tu es marqué absent
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SiteShell>
  );
}