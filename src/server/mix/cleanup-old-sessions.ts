import "server-only";
import { db } from "@/lib/prisma";

/**
 * Supprime les sessions de mix générées avant aujourd'hui (minuit) — donc
 * uniquement les sessions du jour restent visibles dans l'historique.
 * Les équipes et membres associés partent en cascade (onDelete: Cascade
 * sur Team/TeamMember/MixSessionPlayer).
 *
 * Appelé de façon paresseuse à chaque chargement d'une page mix : pas
 * besoin de cron sur le VPS, la purge se fait toute seule dès la première
 * visite de la journée.
 */
export async function cleanupOldMixSessions(): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await db.mixSession.deleteMany({
    where: { createdAt: { lt: startOfToday } },
  });
}
