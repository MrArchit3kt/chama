import Image from "next/image";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { mainLinks, adminLinks, adminMixLinks } from "@/lib/nav-links";

export async function SiteSidebar() {
  const user = await getSessionUser();
  const canSeeAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-6">
        <div className="neon-card p-5">
          <div className="mb-6 border-b border-white/5 pb-5">
            <Link
              href="/acceuil"
              className="flex items-center gap-3 transition hover:opacity-80"
              title="Retour à l’accueil"
            >
              {/* ✅ Logo 3D */}
              <div className="logo-3d logo-3d--auto logo-3d--glow">
                <div className="logo-3d__inner relative h-14 w-14 overflow-hidden rounded-2xl border border-cyan-400/20 bg-black/30">
                  <Image
                    src="/images/CHAMA-logo.jpg"
                    alt="Logo CHAMA"
                    fill
                    sizes="56px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  CHAMA
                </p>
                <h2 className="neon-title neon-gradient-text text-lg font-black">
                  CHAMA Manager
                </h2>
              </div>
            </Link>
          </div>

          <nav className="space-y-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Navigation
            </p>

            {mainLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/80 transition hover:border-cyan-400/15 hover:bg-white/[0.03] hover:text-white"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition group-hover:border-cyan-400/20 group-hover:bg-cyan-400/[0.06]">
                    <Icon className="h-4 w-4 text-cyan-300/90" />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {canSeeAdmin ? (
            <div className="mt-6 border-t border-white/5 pt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Administration
              </p>

              <div className="space-y-2">
                {adminLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/75 transition hover:border-pink-400/15 hover:bg-white/[0.03] hover:text-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition group-hover:border-pink-400/20 group-hover:bg-pink-400/[0.06]">
                        <Icon className="h-4 w-4 text-pink-300/90" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Gestion des mix
              </p>

              <div className="space-y-2">
                {adminMixLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/75 transition hover:border-cyan-400/15 hover:bg-white/[0.03] hover:text-white"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] transition group-hover:border-cyan-400/20 group-hover:bg-cyan-400/[0.06]">
                        <Icon className="h-4 w-4 text-cyan-300/90" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}