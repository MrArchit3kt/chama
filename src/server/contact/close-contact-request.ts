"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

export async function closeContactRequest(formData: FormData) {
  const admin = await requireAdmin("contact");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "contact.manage")) {
    redirect("/admin/contact?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/admin/contact?error=server");
  }

  try {
    const request = await db.contactRequest.update({
      where: { id },
      data: {
        status: "CLOSED",
      },
      select: { subject: true },
    });

    await logActivity({
      action: "CONTACT_CLOSED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: request.subject,
    });
  } catch (error) {
    await logServerError("CLOSE_CONTACT_REQUEST_ERROR", error);
    redirect("/admin/contact?error=server");
  }

  redirect("/admin/contact?closed=1");
}