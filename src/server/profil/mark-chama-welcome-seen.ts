"use server";

import { db } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth/session";

/**
 * Marque le pop-up "Bienvenue dans la team CHAMA" comme vu, pour qu'il ne
 * réapparaisse plus (jusqu'au prochain passage isChamaMember false -> true).
 * Appelée directement depuis le composant client du pop-up, pas de
 * redirection : on reste sur la page où l'utilisateur se trouve.
 */
export async function markChamaWelcomeSeen() {
  const user = await getSessionUser();
  if (!user) return;

  try {
    await db.user.update({
      where: { id: user.id },
      data: { chamaWelcomeSeenAt: new Date() },
    });
  } catch (error) {
    console.error("MARK_CHAMA_WELCOME_SEEN_ERROR", error);
  }
}
