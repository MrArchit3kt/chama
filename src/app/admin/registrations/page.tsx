export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { approveRegistration } from "@/server/admin/approve-registration";
import { rejectRegistration } from "@/server/admin/reject-registration";
import { AdminPlayersRealtime } from "@/components/admin/admin-players-realtime";

function formatDate(value: Date | null) {
  if (!value) return "Jamais";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "validation":
      return "Requête invalide.";
    case "player_not_found":
      return "Utilisateur introuvable.";
    case "server":
      return "Erreur serveur pendant l’action demandée.";
    default:
      return null;
  }
}

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    approved?: string;
    rejected?: string;
  }>;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(sp.error);
  const isApproved = sp.approved === "1";
  const isRejected = sp.rejected === "1";

  const pendingUsers = await db.user.findMany({
    where: {
      registrationStatus: "PENDING",
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      displayName: true,
      username: true,
      email: true,
      warzoneUsername: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <SiteShell>
      <AdminPlayersRealtime channel="registrations" />

      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
            Admin Registrations
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Validation des inscriptions
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
            Accepte ou refuse les nouveaux comptes avant leur accès au site.
          </p>
        </div>

        {errorMessage ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
          </div>
        ) : null}

        {isApproved ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-emerald-300">
              Inscription approuvée avec succès.
            </p>
          </div>
        ) : null}

        {isRejected ? (
          <div className="neon-card p-5">
            <p className="text-sm font-medium text-amber-300">
              Inscription refusée avec succès.
            </p>
          </div>
        ) : null}

        <div className="neon-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
              Demandes en attente
            </p>
            <span className="neon-badge">{pendingUsers.length} total</span>
          </div>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucune demande d’inscription en attente.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((user) => (
              <div key={user.id} className="neon-card p-5 md:p-6">
                <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {user.displayName}
                      </h2>

                      <span className="neon-badge">@{user.username}</span>
                      <span className="neon-badge">{user.role}</span>
                      <span className="neon-badge">{user.status}</span>
                      <span className="rounded-full border border-amber-400/20 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                        PENDING
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                          Email
                        </p>
                        <p className="mt-1 text-sm text-white break-all">
                          {user.email}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                          Warzone
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {user.warzoneUsername}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                          Inscription
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {formatDate(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                    <form action={approveRegistration}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className="neon-button w-full px-4 py-2.5 md:px-5 md:py-3">
                        Accepter
                      </button>
                    </form>

                    <form action={rejectRegistration}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="neon-button-secondary w-full px-4 py-2.5 md:px-5 md:py-3"
                      >
                        Refuser
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}