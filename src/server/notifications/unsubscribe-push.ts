"use server";

import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

/**
 * Supprime l'abonnement push du navigateur courant (désactivation manuelle
 * depuis le profil, ou nettoyage après `pushManager.getSubscription()`
 * introuvable côté navigateur).
 */
export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireAuth();
  if (!user || !endpoint) return { ok: false };

  try {
    await db.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
    return { ok: true };
  } catch (error) {
    await logServerError("UNSUBSCRIBE_PUSH_ERROR", error);
    return { ok: false };
  }
}
