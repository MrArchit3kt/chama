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

export async function toggleChamaMember(formData: FormData) {
  const admin = await requireAdmin("players");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "players.chama.toggle")) {
    redirect("/admin/players?error=forbidden");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const nextValue = String(formData.get("nextValue") ?? "").trim();

  if (!userId || (nextValue !== "true" && nextValue !== "false")) {
    redirect("/admin/players?error=validation");
  }

  try {
    const targetUser = await db.user.update({
      where: { id: userId },
      data: {
        isChamaMember: nextValue === "true",
        // ✅ Réactive le pop-up de bienvenue à chaque passage à true
        // (nouveau membre, ou ré-ajout après un retrait).
        ...(nextValue === "true" ? { chamaWelcomeSeenAt: null } : {}),
      },
      select: { id: true, displayName: true, username: true },
    });

    await logActivity({
      action: "CHAMA_TOGGLED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetId: targetUser.id,
      targetLabel: `${targetUser.displayName} (@${targetUser.username})`,
      metadata: { enabled: nextValue === "true" },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;

    await logServerError("TOGGLE_CHAMA_MEMBER_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect(`/admin/players?chama=${nextValue === "true" ? "1" : "0"}`);
}
