"use server";

import { db } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

/**
 * Marque le pop-up "Compte validé par la Team CHAMA" comme vu, pour qu'il ne
 * réapparaisse plus. Appelée directement depuis le composant client du
 * pop-up, pas de redirection : on reste sur la page où l'utilisateur se
 * trouve.
 */
export async function markApprovalWelcomeSeen() {
  const user = await getSessionUser();
  if (!user) return;

  try {
    await db.user.update({
      where: { id: user.id },
      data: { approvalWelcomeSeenAt: new Date() },
    });
  } catch (error) {
    await logServerError("MARK_APPROVAL_WELCOME_SEEN_ERROR", error);
  }
}
