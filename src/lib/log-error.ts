import "server-only";
import { db } from "@/lib/prisma";

/**
 * Journalise une erreur inattendue en base (table ErrorLog), consultable
 * depuis /admin/errors, en plus du console.error habituel (toujours utile
 * dans `pm2 logs`). Best-effort total : ne doit jamais faire planter
 * l'appelant à cause d'un souci d'écriture en base — un log qui échoue ne
 * doit jamais transformer une erreur gérée en crash.
 */
export async function logServerError(
  context: string,
  error: unknown,
  extra?: { userId?: string; url?: string },
) {
  console.error(`[${context}]`, error);

  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? null) : null;

    await db.errorLog.create({
      data: {
        context,
        message: message.slice(0, 2000),
        stack: stack?.slice(0, 8000),
        userId: extra?.userId,
        url: extra?.url,
      },
    });

    // Nettoyage occasionnel pour ne pas laisser la table grossir à l'infini
    // (même logique que le rate-limiter : 1% de chance à chaque écriture).
    if (Math.random() < 0.01) {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      await db.errorLog.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - THIRTY_DAYS_MS) } },
      });
    }
  } catch (loggingError) {
    console.error("LOG_SERVER_ERROR_FAILED", loggingError);
  }
}
