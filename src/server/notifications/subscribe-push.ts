"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

type PushSubscriptionInput = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

/**
 * Enregistre (ou met à jour) l'abonnement push du navigateur courant pour
 * l'utilisateur connecté. Appelé directement depuis le composant client
 * après un `pushManager.subscribe()` réussi — pas de <form>, on reçoit
 * l'objet subscription tel quel (sérialisé par le navigateur).
 */
export async function subscribeToPush(
  subscription: PushSubscriptionInput,
  userAgent?: string,
): Promise<{ ok: boolean }> {
  const user = await requireAuth();
  if (!user) return { ok: false };

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false };
  }

  try {
    await db.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        userId: user.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      },
      create: {
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent ?? null,
      },
    });

    return { ok: true };
  } catch (error) {
    await logServerError("SUBSCRIBE_PUSH_ERROR", error);
    return { ok: false };
  }
}
