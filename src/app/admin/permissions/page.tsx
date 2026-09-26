export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireSuperAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { setAdminPermissions } from "@/server/admin/set-admin-permissions";
import {
  ADMIN_SECTIONS,
  permissionsForSection,
  ADMIN_PERMISSIONS,
} from "@/lib/admin-permissions";

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Requête invalide.";
    case "player_not_found":
      return "Admin introuvable.";
    case "not_admin":
      return "Ce compte n’a pas le rôle Admin (les super admins ont toujours tout, les joueurs n’ont pas de permissions admin à gérer).";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function AdminPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const superAdmin = await requireSuperAdmin();

  if (!superAdmin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isSuccess = sp.success === "1";

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      displayName: true,
      username: true,
      status: true,
      adminPermissions: true,
    },
    orderBy: { displayName: "asc" },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-fuchsia-300/75">
            Super Admin
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Permissions des admins
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Choisis précisément ce que chaque admin a le droit de faire. Un
            admin sans aucune permission d’une section n’y a plus accès du
            tout. Le passage admin/retrait admin reste réservé aux super
            admins et n’apparaît pas ici.
          </p>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isSuccess ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-400">
              Permissions mises à jour avec succès.
            </p>
          </div>
        ) : null}

        {admins.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucun admin pour le moment (les super admins ne sont pas
              concernés par cette page).
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {admins.map((adminUser) => (
              <details key={adminUser.id} className="group neon-card overflow-hidden p-0">
                <summary className="list-none cursor-pointer p-4 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-white md:text-lg">
                        {adminUser.displayName}
                      </h2>
                      <span className="neon-badge text-[10px] md:text-xs">
                        @{adminUser.username}
                      </span>
                      <span className="neon-badge text-[10px] md:text-xs">
                        {adminUser.adminPermissions.length} permission
                        {adminUser.adminPermissions.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <span className="text-sm text-white/50 transition-transform duration-200 group-open:rotate-180">
                      ▼
                    </span>
                  </div>
                </summary>

                <div className="border-t border-white/8 p-4 md:p-6">
                  <form action={setAdminPermissions} className="grid gap-4">
                    <input type="hidden" name="userId" value={adminUser.id} />

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {ADMIN_SECTIONS.map((section) => (
                        <div
                          key={section.key}
                          className="rounded-2xl border border-white/8 bg-white/[0.02] p-3.5"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                            {section.label}
                          </p>

                          <div className="mt-2.5 grid gap-2">
                            {permissionsForSection(section.key).map((key) => (
                              <label
                                key={key}
                                className="flex items-start gap-2 text-xs text-white/80"
                              >
                                <input
                                  type="checkbox"
                                  name="permissions"
                                  value={key}
                                  defaultChecked={adminUser.adminPermissions.includes(key)}
                                  className="mt-0.5 h-3.5 w-3.5"
                                />
                                <span>{ADMIN_PERMISSIONS[key].label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <button type="submit" className="neon-button px-5 py-2.5">
                        Enregistrer les permissions
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
