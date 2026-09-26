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
 * ⚠️ Suppression définitive et irréversible du compte (contrairement au
 * bannissement, qui reste réversible). La plupart des données liées
 * partent en cascade (équipes, notifications, badges, événements...),
 * sauf les avertissements émis en tant qu'admin (onDelete: Restrict côté
 * Warning.adminUser) : si ce joueur a déjà été admin et a émis des
 * avertissements, la suppression échoue proprement plutôt que de casser
 * l'historique de modération d'un autre joueur.
 */
export async function deletePlayer(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.delete")) {
    redirect("/admin/players?error=forbidden");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirect("/admin/players?error=validation");
  }

  if (userId === admin.id) {
    redirect("/admin/players?error=self_delete");
  }

  try {
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, role: true },
    });

    if (!target) {
      redirect("/admin/players?error=player_not_found");
    }

    if (target.role === "ADMIN" || target.role === "SUPER_ADMIN") {
      redirect("/admin/players?error=admin_delete_locked");
    }

    await db.user.delete({ where: { id: userId } });

    await logActivity({
      action: "PLAYER_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: `${target.displayName} (@${target.username})`,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;

    // Contrainte FK (ex: avertissements émis en tant qu'ex-admin) : erreur
    // propre plutôt qu'un crash générique.
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2003" || code === "P2014") {
      redirect("/admin/players?error=has_related_records");
    }

    await logServerError("DELETE_PLAYER_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?deleted=1");
}
