export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { rocketLeagueRankLabel, warzoneRankTierLabel } from "@/lib/ranks";

export default async function MembresPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const members = await db.user.findMany({
    where: { status: "ACTIVE", registrationStatus: "APPROVED" },
    select: {
      id: true,
      username: true,
      isOnline: true,
      isChamaMember: true,
      rocketLeagueRank: true,
      warzoneRankTier: true,
    },
    orderBy: [{ isOnline: "desc" }, { username: "asc" }],
  });

  const onlineCount = members.filter((m) => m.isOnline).length;

  return (
    <SiteShell>
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Communauté
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Membres
          </h1>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Tous les membres actifs de CHAMA : pseudo, statut et rangs.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="neon-badge">{members.length} membre{members.length > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {onlineCount} en ligne
            </span>
          </div>
        </div>

        <div className="neon-card p-4 md:p-6">
          {members.length === 0 ? (
            <p className="neon-text-muted p-4 text-sm">Aucun membre pour le moment.</p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {members.map((member) => (
                <div key={member.id} className="neon-card-soft p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          member.isOnline ? "bg-emerald-400" : "bg-white/20"
                        }`}
                        title={member.isOnline ? "En ligne" : "Hors ligne"}
                      />
                      <p className="truncate text-sm font-bold text-white">@{member.username}</p>
                    </div>

                    {member.isChamaMember ? (
                      <span className="shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                        CHAMA
                      </span>
                    ) : null}
                  </div>

                  <p className="neon-text-muted mt-2 truncate text-[11px]">
                    RL : <span className="text-white">{rocketLeagueRankLabel(member.rocketLeagueRank)}</span>
                  </p>
                  <p className="neon-text-muted mt-1 truncate text-[11px]">
                    Ranked WZ : <span className="text-white">{warzoneRankTierLabel(member.warzoneRankTier)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
