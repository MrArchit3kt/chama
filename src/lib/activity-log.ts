import "server-only";
import { db } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type ActivityAction =
  | "REGISTRATION_CREATED"
  | "REGISTRATION_APPROVED"
  | "REGISTRATION_REJECTED"
  | "ROLE_CHANGED"
  | "ADMIN_PERMISSIONS_UPDATED"
  | "CHAMA_TOGGLED"
  | "AURA_TOGGLED"
  | "PLAYER_BANNED"
  | "PLAYER_UNBANNED"
  | "PLAYER_DELETED"
  | "PASSWORD_RESET"
  | "WARNING_ADDED"
  | "WARNING_REVOKED"
  | "BADGE_CREATED"
  | "BADGE_DELETED"
  | "BADGE_AWARDED"
  | "BADGE_REVOKED"
  | "DISCORD_CHANNEL_CREATED"
  | "DISCORD_CHANNEL_UPDATED"
  | "DISCORD_CHANNEL_DELETED"
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "EVENT_ROSTER_UPDATED"
  | "CONTACT_CLOSED"
  | "SITE_CONFIG_UPDATED"
  | "MIX_GENERATED";

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
