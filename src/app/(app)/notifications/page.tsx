export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";
import { db } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getNotificationTypeLabel(type: string) {
  switch (type) {
    case "EVENT_PUBLISHED":
      return "Événement publié";
    case "EVENT_UPDATED":
      return "Événement modifié";
    case "EVENT_REMINDER":
      return "Rappel événement";
    case "WARNING_RECEIVED":
      return "Avertissement reçu";
    case "BAN_APPLIED":
      return "Ban appliqué";
    case "BAN_LIFTED":
      return "Ban levé";
    case "RULES_UPDATED":
      return "Règlement mis à jour";
    case "INFO":
      return "Information";
    default:
      return type;
  }
}

function getNotificationStatusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "En attente";
    case "SENT":
      return "Envoyée";
    case "FAILED":
      return "Échec";
    case "READ":
      return "Lue";
    default:
      return status;
  }
}

export default async function NotificationsPage() {
  const user = await requireAuth();

  if (!user) {
    redirect("/login");
  }

  await db.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
      status: "READ",
    },
  });

  const notifications = await db.notification.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      channel: true,
      status: true,
      createdAt: true,
      readAt: true,
    },
  });

  return (
    <SiteShell>
      <div className="grid gap-4 md:gap-6">
        <div className="neon-card p-4 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Alertes
          </p>
          <h1 className="neon-title neon-gradient-text mt-2 text-xl font-black md:mt-3 md:text-3xl">
            Mes notifications
          </h1>
          <p className="neon-text-muted mt-2 hidden max-w-3xl text-sm leading-6 md:mt-4 md:block md:text-base md:leading-7">
            Toutes les notifications non lues ont été marquées comme lues à
            l’ouverture de cette page.
          </p>
        </div>

        {notifications.length === 0 ? (
          <div className="neon-card p-5 md:p-8">
            <p className="neon-text-muted text-sm">
              Aucune notification pour le moment.
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:gap-2.5">
            {notifications.map((notification) => (
              <details key={notification.id} className="group neon-card relative overflow-hidden p-0">
                <summary className="list-none cursor-pointer p-3 pr-8 md:p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="neon-badge">
                      {getNotificationTypeLabel(notification.type)}
                    </span>

                    <span
                      className={
                        notification.status === "READ"
                          ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"
                          : "rounded-full border border-pink-400/20 bg-pink-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-300"
                      }
                    >
                      {getNotificationStatusLabel(notification.status)}
                    </span>
                  </div>

                  <p className="mt-1.5 truncate text-sm font-bold text-white md:text-base">
                    {notification.title}
                  </p>

                  <p className="neon-text-muted mt-0.5 truncate text-xs">
                    {formatDate(notification.createdAt)}
                  </p>

                  <span className="pointer-events-none absolute right-3 top-3 text-xs text-white/40 transition group-open:rotate-180 md:right-4 md:top-4">
                    ▼
                  </span>
                </summary>

                <div className="border-t border-white/8 px-3 pb-3 pt-3 md:px-4 md:pb-4">
                  <p className="neon-text-muted text-xs">Canal : {notification.channel}</p>
                  <p className="neon-text-muted mt-2 text-sm leading-6">
                    {notification.message}
                  </p>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}