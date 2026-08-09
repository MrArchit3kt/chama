export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HomePage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const [config, events] = await Promise.all([
    db.siteConfig.findUnique({
      where: { id: "main" },
      select: {
        homeHeadline: true,
        homeDescription: true,
        homeHeroImageUrl: true,
        eventsEnabled: true,
      },
    }),
    db.event.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        eventDate: "asc",
      },
      take: 3,
      select: {
        id: true,
        title: true,
        description: true,
        eventDate: true,
        coverImageUrl: true,
        slug: true,
        status: true,
      },
    }),
  ]);

  const homeHeadline = config?.homeHeadline ?? "CHAMA Gaming Squad";
  const homeDescription =
    config?.homeDescription ??
    "Plateforme de gestion de team, mix automatique, événements, modération et organisation complète de la communauté.";

  const heroImageUrl = config?.homeHeroImageUrl?.trim() || "/images/CHAMA-hero.jpg";
  const eventsEnabled = config?.eventsEnabled ?? true;

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <section className="neon-card overflow-hidden p-0">
          <div className="relative min-h-[320px] md:min-h-[460px]">
            <Image
              src={heroImageUrl}
              alt={homeHeadline}
              fill
              priority
              className="object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />

            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
              <div className="max-w-3xl">
                <span className="neon-badge">Communauté privée</span>

                <h1 className="neon-title neon-gradient-text mt-4 text-3xl font-black md:text-5xl">
                  {homeHeadline}
                </h1>

                <p className="neon-text-muted mt-4 text-sm leading-7 md:text-base">
                  {homeDescription}
                </p>
              </div>
            </div>
          </div>
        </section>

        {eventsEnabled ? (
          <section className="neon-card p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                  Événements annoncés
                </p>
                <h2 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
                  Les prochaines annonces
                </h2>
              </div>

              <Link href="/events" className="neon-button-secondary px-4 py-2.5 md:px-5 md:py-3">
                Voir tous les événements
              </Link>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {events.length === 0 ? (
                <div className="neon-card-soft p-5 lg:col-span-3">
                  <p className="neon-text-muted text-sm">
                    Aucun événement publié pour le moment.
                  </p>
                </div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="neon-card-soft overflow-hidden p-0">
                    {event.coverImageUrl ? (
                      <div className="relative h-44 w-full">
                        <img
                          src={event.coverImageUrl}
                          alt={event.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-white">{event.title}</h3>
                        <span className="neon-badge">{event.status}</span>
                      </div>

                      <p className="neon-text-muted mt-3 text-sm">
                        {formatDate(event.eventDate)}
                      </p>

                      <p className="neon-text-muted mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="neon-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
              Mix auto
            </p>
            <h2 className="mt-3 text-xl font-bold text-white">
              Répartition rapide
            </h2>
            <p className="neon-text-muted mt-3 text-sm leading-6">
              Génère des équipes équilibrées de 3 et 4 joueurs sans laisser de
              joueur de côté.
            </p>
          </div>

          <div className="neon-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
              Modération
            </p>
            <h2 className="mt-3 text-xl font-bold text-white">
              Gestion des sanctions
            </h2>
            <p className="neon-text-muted mt-3 text-sm leading-6">
              Warnings, révocations, bannissements automatiques et suivi admin
              centralisé.
            </p>
          </div>

          <div className="neon-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300/75">
              Contact
            </p>
            <h2 className="mt-3 text-xl font-bold text-white">
              Remonter un besoin
            </h2>
            <p className="neon-text-muted mt-3 text-sm leading-6">
              Contacte les admins pour un signalement, un bug ou une amélioration.
            </p>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}