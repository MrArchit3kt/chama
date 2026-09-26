import "server-only";
import { db } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ActivityAction } from "@/generated/prisma/enums";

type LogActivityParams = {
  action: ActivityAction;
  actorId?: string | null;
  actorLabel: string;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Journalise une action admin/système pour le journal d'activité
 * (/admin/activity, super admin uniquement). Best-effort total, comme
 * logServerError : un souci d'écriture ici ne doit JAMAIS transformer une
 * action réussie en erreur pour l'utilisateur.
 *
 * actorLabel/targetLabel sont des snapshots texte (pas seulement l'id) :
 * le journal reste lisible même après suppression du compte concerné
 * (voir deletePlayer, onDelete: SetNull côté schéma).
 */
export async function logActivity(params: LogActivityParams) {
  try {
    await db.activityLog.create({
      data: {
        action: params.action,
        actorId: params.actorId ?? null,
        actorLabel: params.actorLabel,
        targetId: params.targetId ?? null,
        targetLabel: params.targetLabel ?? null,
        metadata: params.metadata,
      },
    });
  } catch (error) {
    console.error("LOG_ACTIVITY_FAILED", error);
  }
}
