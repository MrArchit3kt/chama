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
        <div className="neon-card p-5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pink-300/75">
            Alertes
          </p>
          <h1 className="neon-title neon-gradient-text mt-3 text-2xl font-black md:text-3xl">
            Mes notifications
          </h1>
          <p className="neon-text-muted mt-3 max-w-3xl text-sm leading-6 md:mt-4 md:text-base md:leading-7">
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
          <div className="grid gap-3 md:gap-4">
            {notifications.map((notification) => (
              <div key={notification.id} className="neon-card p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                      <span className="neon-badge">
                        {getNotificationTypeLabel(notification.type)}
                      </span>

                      <span className="neon-badge">{notification.channel}</span>

                      <span
                        className={
                          notification.status === "READ"
                            ? "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 md:px-3 md:py-1 md:text-xs md:tracking-[0.18em]"
                            : "rounded-full border border-pink-400/20 bg-pink-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-300 md:px-3 md:py-1 md:text-xs md:tracking-[0.18em]"
                        }
                      >
                        {getNotificationStatusLabel(notification.status)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-base font-bold text-white md:mt-4 md:text-lg">
                      {notification.title}
                    </h2>

                    <p className="neon-text-muted mt-2 text-sm leading-6 md:mt-3 md:leading-7">
                      {notification.message}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <p className="text-xs text-white/50">
                      {formatDate(notification.createdAt)}
                    </p>
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