export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiTwitch } from "react-icons/si";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { getLiveTwitchStreams, isTwitchConfigured } from "@/lib/twitch";

export default async function LivesPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const streamers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      registrationStatus: "APPROVED",
      twitchUsername: { not: null },
    },
    select: { id: true, username: true, displayName: true, twitchUsername: true },
    orderBy: { username: "asc" },
  });

  const configured = isTwitchConfigured();
  const liveStreams = configured
    ? await getLiveTwitchStreams(streamers.map((s) => s.twitchUsername!))
    : new Map();

  const sorted = [...streamers].sort((a, b) => {
    const aLive = liveStreams.has(a.twitchUsername!.toLowerCase()) ? 0 : 1;
    const bLive = liveStreams.has(b.twitchUsername!.toLowerCase()) ? 0 : 1;
    return aLive - bLive;
  });

  const liveCount = sorted.filter((s) => liveStreams.has(s.twitchUsername!.toLowerCase())).length;

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-300/75">
            Twitch
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Lives de la communauté
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Les joueurs qui ont renseigné leur pseudo Twitch dans leur profil
            apparaissent ici, automatiquement en live dès qu’ils lancent leur
            stream.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="neon-badge">
              {streamers.length} streamer{streamers.length > 1 ? "s" : ""}
            </span>
            {configured ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                {liveCount} en live
              </span>
            ) : null}
          </div>
        </div>

        {!configured ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              La détection automatique des lives n’est pas encore configurée
              côté admin. Les chaînes ci-dessous restent consultables, le
              badge « EN LIVE » apparaîtra dès que ce sera activé.
            </p>
          </div>
        ) : null}

        <div className="neon-card p-4 md:p-6">
          {sorted.length === 0 ? (
            <p className="neon-text-muted p-4 text-sm">
              Aucun joueur n’a encore renseigné son Twitch. Direction Profil
              pour ajouter le tien.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sorted.map((streamer) => {
                const stream = liveStreams.get(streamer.twitchUsername!.toLowerCase());
                const isLive = Boolean(stream);
                const channelUrl = `https://twitch.tv/${streamer.twitchUsername}`;

                return (
                  <a
                    key={streamer.id}
                    href={channelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      isLive
                        ? "neon-card-soft overflow-hidden border border-rose-400/30 bg-rose-400/[0.04] p-0 transition hover:-translate-y-0.5"
                        : "neon-card-soft overflow-hidden p-0 transition hover:-translate-y-0.5"
                    }
                  >
                    {isLive && stream ? (
                      <div className="relative h-32 w-full bg-black/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={stream.thumbnailUrl}
                          alt={stream.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                          En live
                        </span>
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {stream.viewerCount} viewer{stream.viewerCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    ) : null}

                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <SiTwitch className="h-4 w-4 shrink-0 text-purple-300" />
                          <p className="truncate text-sm font-bold text-white">
                            {streamer.displayName}
                          </p>
                        </div>
                        {!isLive ? (
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/50">
                            Hors ligne
                          </span>
                        ) : null}
                      </div>

                      <p className="neon-text-muted mt-1 truncate text-[11px]">
                        twitch.tv/{streamer.twitchUsername}
                      </p>

                      {isLive && stream ? (
                        <p className="mt-2 truncate text-xs text-white/80">{stream.title}</p>
                      ) : null}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
