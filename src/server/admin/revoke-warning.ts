"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";

export async function revokeWarning(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const warningId = String(formData.get("warningId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!warningId) {
    redirect("/admin/players?error=validation");
  }

  try {
    const warning = await db.warning.findUnique({
      where: { id: warningId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!warning) {
      redirect("/admin/players?error=player_not_found");
    }

    if (warning.status !== "ACTIVE") {
      redirect("/admin/players?revoked=1");
    }

    await db.warning.update({
      where: { id: warning.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: reason || "Révocation manuelle par un admin.",
        revokedByAdminId: admin.id,
      },
    });

    publishAdminEvent("players");
  } catch (error) {
    await logServerError("REVOKE_WARNING_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?revoked=1");
}