export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

export default async function RulesPage() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  const rules = await db.rulesVersion.findFirst({
    where: {
      isActive: true,
      isPublished: true,
    },
    orderBy: {
      versionNumber: "desc",
    },
    select: {
      title: true,
      content: true,
      versionNumber: true,
      publishedAt: true,
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Règlement
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
            Règlement officiel de la communauté
          </h1>
          <p className="neon-text-muted mt-4 max-w-3xl leading-7">
            Lis attentivement les règles de jeu, de comportement et de vie de la communauté CHAMA.
          </p>
        </div>

        {!rules ? (
          <div className="neon-card p-8">
            <p className="neon-text-muted text-sm">
              Aucun règlement publié pour le moment.
            </p>
          </div>
        ) : (
          <div className="neon-card p-8">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{rules.title}</h2>
              <span className="neon-badge">Version {rules.versionNumber}</span>
            </div>

            <div className="neon-text-muted mt-6 space-y-4 whitespace-pre-wrap leading-7 text-sm md:text-base">
              {rules.content}
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  );
}