"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

export async function setEventPresence(formData: FormData) {
  const user = await requireAuth();

  if (!user) {
    redirect("/login");
  }

  const eventId = String(formData.get("eventId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!eventId || !action) {
    redirect("/events?error=server");
  }

  let status: "CONFIRMED" | "CANCELLED";

  if (action === "present") {
    status = "CONFIRMED";
  } else if (action === "absent") {
    status = "CANCELLED";
  } else {
    redirect("/events?error=server");
  }

  try {
    await db.eventParticipant.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId: user.id,
        },
      },
      update: {
        status,
      },
      create: {
        eventId,
        userId: user.id,
        status,
      },
    });
  } catch (error) {
    await logServerError("SET_EVENT_PRESENCE_ERROR", error);
    redirect("/events?error=server");
  }

  redirect("/events?success=1");
}