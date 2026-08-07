export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Car, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";

export default async function Gta6Page() {
  const sessionUser = await requireAuth();
  if (!sessionUser) redirect("/login");

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300/75">
            GTA 6
          </p>
          <h2 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Notre futur serveur GTA 6
          </h2>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Cette section est en préparation, elle accueillera bientôt tout ce
            qu’il faut savoir sur le serveur CHAMA GTA 6 : infos, recrutement,
            et bien plus.
          </p>
        </div>

        <div className="neon-card flex flex-col items-center gap-4 p-10 text-center md:p-16">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10">
            <Car className="h-8 w-8 text-amber-300" />
          </span>

          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Prochainement
            </p>
            <h3 className="mt-4 text-xl font-bold text-white md:text-2xl">
              Des infos sur notre futur serveur GTA 6 arrivent bientôt
            </h3>
            <p className="neon-text-muted mx-auto mt-3 max-w-md text-sm leading-6">
              On travaille dessus. Reste connecté, tout sera annoncé ici et sur
              le Discord dès que ce sera prêt.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
