"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { mainLinks, adminLinks, adminMixLinks } from "@/lib/nav-links";

type MobileNavProps = {
  canSeeAdmin: boolean;
};

export function MobileNav({ canSeeAdmin }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <Link
          href="/acceuil"
          className="flex items-center gap-3 transition hover:opacity-80"
          title="Retour à l’accueil"
        >
          {/* ✅ Logo 3D */}
          <div className="logo-3d logo-3d--auto logo-3d--glow">
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-cyan-400/20 bg-black/30">
              <Image
                src="/images/CHAMA-logo.jpg"
                alt="Logo CHAMA"
                fill
                sizes="40px"
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
              CHAMA
            </p>
            <h2 className="neon-title neon-gradient-text text-base font-black">
              CHAMA Manager
            </h2>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="neon-button-secondary flex h-11 w-11 items-center justify-center"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          />

          <aside className="absolute left-0 top-0 h-dvh w-[78%] max-w-[320px]">
            <div className="neon-card flex h-full flex-col rounded-none rounded-r-3xl p-4">
              <div className="mb-4 flex shrink-0 items-center justify-between border-b border-white/5 pb-4">
                <Link
                  href="/acceuil"
                  onClick={() => setOpen(false)}
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
                    <h2 className="neon-title neon-gradient-text text-base font-black">
                      CHAMA Squad Manager
                    </h2>
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="neon-button-secondary flex h-10 w-10 items-center justify-center"
                  aria-label="Fermer le menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                        onClick={() => setOpen(false)}
                        className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/80 transition hover:border-cyan-400/15 hover:bg-white/[0.03] hover:text-white"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03]">
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
                            onClick={() => setOpen(false)}
                            className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/75 transition hover:border-pink-400/15 hover:bg-white/[0.03] hover:text-white"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03]">
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

                    <div className="space-y-2 pb-6">
                      {adminMixLinks.map((item) => {
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="group flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-medium text-white/75 transition hover:border-cyan-400/15 hover:bg-white/[0.03] hover:text-white"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03]">
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
        </div>
      ) : null}
    </>
  );
}