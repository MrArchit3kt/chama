"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { deleteLocalEventImage } from "@/server/events/_event-image";
import { logServerError } from "@/lib/log-error";

export async function deleteEvent(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect("/admin/events?error=validation");
  }

  const existing = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
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
  } catch (error) {
    await logServerError("DELETE_EVENT_ERROR", error);
    redirect("/admin/events?error=server");
  }

  redirect("/admin/events?deleted=1");
}