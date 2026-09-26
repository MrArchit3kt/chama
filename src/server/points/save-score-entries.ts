"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * ONE_TIME => case cochée (0 ou 1). QUANTITY/TIERED => nombre saisi
 * (toujours >= 0 : c'est un compteur d'occurrences — kills, morts... —
 * jamais les points eux-mêmes, qui peuvent être négatifs sur la
 * condition/le palier).
 */
function parseQuantity(raw: FormDataEntryValue | null, mode: "QUANTITY" | "ONE_TIME" | "TIERED"): number {
  if (mode === "ONE_TIME") {
    return raw === "on" ? 1 : 0;
  }

  const n = Number(String(raw ?? "0").trim() || "0");
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Enregistre en une fois toutes les conditions d'une équipe (ciblant
 * l'équipe entière) et de chacun de ses membres (conditions ciblant un
 * joueur précis) pour un tableau donné. Une quantité à 0 supprime
 * l'entrée existante plutôt que de garder une ligne à 0 (table propre).
 */
export async function saveScoreEntries(formData: FormData) {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  const gameModeId = String(formData.get("gameModeId") ?? "").trim();
  const boardId = String(formData.get("boardId") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();

  const backTo = `/admin/points/${gameModeId}?board=${boardId}`;

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    redirect(`${backTo}&error=forbidden`);
  }

  if (!gameModeId || !boardId || !teamId) {
    redirect("/admin/points?error=validation");
  }

  try {
    const team = await db.scoreTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        board: { select: { gameModeId: true } },
        members: { select: { id: true } },
      },
    });

    if (!team || team.board.gameModeId !== gameModeId) {
      redirect(`${backTo}&error=server`);
    }

    const conditions = await db.scoreCondition.findMany({
      where: { gameModeId },
      select: { id: true, appliesTo: true, mode: true },
    });

    for (const condition of conditions) {
      if (condition.appliesTo === "TEAM") {
        const quantity = parseQuantity(
          formData.get(`team_condition_${condition.id}`),
          condition.mode,
        );

        if (quantity > 0) {
          await db.scoreEntry.upsert({
            where: { conditionId_teamId: { conditionId: condition.id, teamId } },
            update: { quantity },
            create: { conditionId: condition.id, teamId, quantity },
          });
        } else {
          await db.scoreEntry.deleteMany({ where: { conditionId: condition.id, teamId } });
        }
      } else {
        for (const member of team.members) {
          const quantity = parseQuantity(
            formData.get(`member_condition_${member.id}_${condition.id}`),
            condition.mode,
          );

          if (quantity > 0) {
            await db.scoreEntry.upsert({
              where: {
                conditionId_teamMemberId: { conditionId: condition.id, teamMemberId: member.id },
              },
              update: { quantity },
              create: { conditionId: condition.id, teamMemberId: member.id, quantity },
            });
          } else {
            await db.scoreEntry.deleteMany({
              where: { conditionId: condition.id, teamMemberId: member.id },
            });
          }
        }
      }
    }

    await logActivity({
      action: "SCORE_ENTRY_UPDATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `Tableau ${boardId.slice(-6).toUpperCase()}`,
      metadata: { teamId },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SAVE_SCORE_ENTRIES_ERROR", error);
    redirect(`${backTo}&error=server`);
  }

  redirect(`${backTo}&success=1`);
}
