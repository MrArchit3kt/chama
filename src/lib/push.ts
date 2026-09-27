import "server-only";
import webPush from "web-push";
import { db } from "@/lib/prisma";
import { logServerError } from "@/lib/log-error";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:contact@chama-gaming.site";

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

if (isPushConfigured()) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY as string, VAPID_PRIVATE_KEY as string);
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

/**
 * Envoie une notification push à tous les abonnements d'une liste
 * d'utilisateurs. Best-effort : une erreur d'envoi individuelle ne bloque
 * jamais l'action appelante (création d'événement/tournoi) — chaque échec
 * est loggé, et les abonnements expirés/invalides (410/404) sont nettoyés.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!isPushConfigured() || userIds.length === 0) return;

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    const staleIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            await logServerError("PUSH_SEND_ERROR", error);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      await db.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
    }
  } catch (error) {
    await logServerError("PUSH_SEND_ERROR", error);
  }
}

/**
 * Envoie une notification push à tous les utilisateurs actifs du site.
 */
export async function sendPushToAllActiveUsers(payload: PushPayload): Promise<void> {
  if (!isPushConfigured()) return;

  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  await sendPushToUsers(
    users.map((u) => u.id),
    payload,
  );
}
