"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { deleteLocalEventImage } from "@/server/events/_event-image";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

export async function deleteEvent(formData: FormData) {
  const admin = await requireAdmin("events");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "events.manage")) {
    redirect("/admin/events?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/admin/events?error=validation");
  }

  const existing = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
    },
  });

  if (!existing) {
    redirect("/admin/events?error=not_found");
  }

  try {
    await db.event.delete({
      where: { id },
    });

    if (existing.coverImageUrl) {
      await deleteLocalEventImage(existing.coverImageUrl);
    }

    await logActivity({
      action: "EVENT_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: existing.title,
    });
  } catch (error) {
    await logServerError("DELETE_EVENT_ERROR", error);
    redirect("/admin/events?error=server");
  }

  redirect("/admin/events?deleted=1");
}