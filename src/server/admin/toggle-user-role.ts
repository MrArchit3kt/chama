"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";

export async function toggleUserRole(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirect("/admin/players?error=validation");
  }

  if (userId === admin.id) {
    redirect("/admin/players?error=self_role");
  }

  if (admin.role !== "SUPER_ADMIN") {
    redirect("/admin/players?error=forbidden");
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetUser) {
      redirect("/admin/players?error=player_not_found");
    }

    if (targetUser.role === "SUPER_ADMIN") {
      redirect("/admin/players?error=super_admin_locked");
    }

    const nextRole = targetUser.role === "ADMIN" ? "PLAYER" : "ADMIN";

    await db.$transaction([
      db.user.update({
        where: { id: targetUser.id },
        data: {
          role: nextRole,
        },
      }),
      db.roleChangeLog.create({
        data: {
          targetUserId: targetUser.id,
          adminUserId: admin.id,
          previousRole: targetUser.role,
          nextRole,
        },
      }),
    ]);

    await Promise.resolve(publishAdminEvent("players"));
  } catch (error) {
    await logServerError("TOGGLE_USER_ROLE_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?role_updated=1");
}