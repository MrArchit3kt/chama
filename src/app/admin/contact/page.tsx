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
      <div className="grid gap-6">
        <div className="neon-card p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                Admin Contact
              </p>
              <h1 className="neon-title neon-gradient-text mt-3 text-3xl font-black">
                Demandes des utilisateurs
              </h1>
              <p className="neon-text-muted mt-4 max-w-3xl leading-7">
                Consulte les demandes admin, signalements de joueurs, bugs et
                suggestions d’amélioration.
              </p>
            </div>

            <div className="neon-card-soft px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                Ouvertes
              </p>
              <p className="mt-1 text-2xl font-black text-white">{openCount}</p>
            </div>
          </div>
        </div>

        {hasError ? (
          <div className="neon-card p-6">
            <p className="text-sm font-medium text-rose-400">
              Erreur serveur pendant l’action demandée.
            </p>
          </div>
        ) : null}

        {isClosed ? (
          <div className="neon-card p-6">
            <p className="text-sm font-medium text-emerald-400">
              Demande clôturée avec succès.
            </p>
          </div>
        ) : null}

        {requests.length === 0 ? (
          <div className="neon-card p-8">
            <p className="neon-text-muted text-sm">
              Aucune demande reçue pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((item) => (
              <div key={item.id} className="neon-card p-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="neon-badge">{getTypeLabel(item.type)}</span>

                        <span
                          className={
                            item.status === "OPEN"
                              ? "rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300"
                              : "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                          }
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <h2 className="mt-4 text-xl font-bold text-white">
                        {item.subject}
                      </h2>

                      <p className="neon-text-muted mt-2 text-sm">
                        Envoyé par{" "}
                        <span className="text-white">{item.user.displayName}</span> (
                        @{item.user.username})
                      </p>

                      <p className="neon-text-muted mt-1 text-sm">
                        {item.user.email}
                      </p>
                    </div>

                    <p className="text-xs text-white/50">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
                    <p className="text-sm leading-7 text-white">{item.message}</p>
                  </div>

                  {item.status === "OPEN" ? (
                    <form action={closeContactRequest}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="neon-button px-5 py-3">
                        Clôturer la demande
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}