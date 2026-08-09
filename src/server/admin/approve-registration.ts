"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";

export async function approveRegistration(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirect("/admin/registrations?error=validation");
  }

  try {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        registrationStatus: true,
      },
    });

    if (!targetUser) {
      redirect("/admin/registrations?error=player_not_found");
    }

    await db.user.update({
      where: { id: userId },
      data: {
        registrationStatus: "APPROVED",
        status: "ACTIVE",
      },
    });

    publishAdminEvent("players");
    publishAdminEvent("registrations");
  } catch (error) {
    await logServerError("APPROVE_REGISTRATION_ERROR", error);
    redirect("/admin/registrations?error=server");
  }

  redirect("/admin/registrations?approved=1");
}