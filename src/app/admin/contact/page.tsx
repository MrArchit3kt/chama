export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { closeContactRequest } from "@/server/contact/close-contact-request";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getTypeLabel(type: string) {
  switch (type) {
    case "ADMIN_REQUEST":
      return "Demande admin";
    case "PLAYER_REPORT":
      return "Signalement joueur";
    case "BUG":
      return "Bug";
    case "IMPROVEMENT":
      return "Amélioration";
    case "RECRUITMENT":
      return "Demande de recrutement";
    case "LEAVE_TEAM":
      return "Départ de la team";
    default:
      return type;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Ouverte";
    case "CLOSED":
      return "Fermée";
    default:
      return status;
  }
}

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; closed?: string }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const hasError = sp.error === "server";
  const isClosed = sp.closed === "1";

  const requests = await db.contactRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          email: true,
        },
      },
    },
  });

  const openCount = requests.filter((item) => item.status === "OPEN").length;

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-4 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 md:gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Admin Contact
              </p>
              <h1 className="neon-title neon-gradient-text mt-2 text-xl font-black md:mt-3 md:text-3xl">
                Demandes des utilisateurs
              </h1>
              <p className="neon-text-muted mt-2 hidden max-w-3xl text-sm leading-6 md:mt-4 md:block md:text-base md:leading-7">
                Consulte les demandes admin, signalements de joueurs, bugs et
                suggestions d’amélioration.
              </p>
            </div>

            <div className="neon-card-soft px-4 py-3 md:px-5 md:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-300/75 md:text-xs">
                Ouvertes
              </p>
              <p className="mt-1 text-xl font-black text-white md:text-2xl">{openCount}</p>
            </div>
          </div>
        </div>

        {hasError ? (
          <div className="neon-card p-4 md:p-6">
            <p className="text-sm font-medium text-rose-400">
              Erreur serveur pendant l’action demandée.
            </p>
          </div>
        ) : null}

        {isClosed ? (
          <div className="neon-card p-4 md:p-6">
            <p className="text-sm font-medium text-emerald-400">
              Demande clôturée avec succès.
            </p>
          </div>
        ) : null}

        {requests.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucune demande reçue pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:gap-2.5">
            {requests.map((item) => (
              <details key={item.id} className="group neon-card relative overflow-hidden p-0">
                <summary className="list-none cursor-pointer p-3 pr-8 md:p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="neon-badge">{getTypeLabel(item.type)}</span>

                        <span
                          className={
                            item.status === "OPEN"
                              ? "rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300"
                              : "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"
                          }
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-sm font-bold text-white md:text-base">
                        {item.subject}
                      </p>

                      <p className="neon-text-muted mt-0.5 truncate text-xs">
                        {item.user.displayName} (@{item.user.username}) · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <span className="pointer-events-none absolute right-3 top-3 text-xs text-white/40 transition group-open:rotate-180 md:right-4 md:top-4">
                    ▼
                  </span>
                </summary>

                <div className="border-t border-white/8 px-3 pb-3 pt-3 md:px-4 md:pb-4">
                  <p className="neon-text-muted text-xs">{item.user.email}</p>

                  <div className="mt-2.5 rounded-2xl border border-white/8 bg-white/2 p-3 md:p-4">
                    <p className="text-sm leading-6 text-white">{item.message}</p>
                  </div>

                  {item.status === "OPEN" ? (
                    <form action={closeContactRequest} className="mt-2.5">
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="neon-button px-4 py-2 text-sm md:px-5 md:py-2.5">
                        Clôturer la demande
                      </button>
                    </form>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}