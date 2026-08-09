"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import {
  deleteLocalEventImage,
  isLocalEventImage,
  resolveEventImageInput,
} from "@/server/events/_event-image";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "PUBLISHED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
]);

export async function updateEvent(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!id || !title || !description || !eventDate || !ALLOWED_STATUSES.has(status)) {
    redirect("/admin/events?error=validation");
  }

  const startDate = new Date(eventDate);
  const finalEndDate = endDate ? new Date(endDate) : null;

  if (Number.isNaN(startDate.getTime())) {
    redirect("/admin/events?error=validation");
  }

  if (finalEndDate && Number.isNaN(finalEndDate.getTime())) {
    redirect("/admin/events?error=validation");
  }

  if (finalEndDate && finalEndDate < startDate) {
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

  let uploadedLocalImageUrl: string | null = null;

  try {
    const imageResult = await resolveEventImageInput(
      formData.get("coverImageUrl"),
      formData.get("coverImageFile"),
    );

    uploadedLocalImageUrl = imageResult.uploadedLocalImageUrl;

    const nextImageUrl = imageResult.nextImageUrl;
    const previousImageUrl = existing.coverImageUrl;

    await db.event.update({
      where: { id },
      data: {
        title,
        slug: `${slugify(title)}-${id.slice(-6).toLowerCase()}`,
        description,
        eventDate: startDate,
        endDate: finalEndDate,
        coverImageUrl: nextImageUrl,
        status: status as "DRAFT" | "PUBLISHED" | "LIVE" | "COMPLETED" | "CANCELLED",
        publishInApp: formData.get("publishInApp") === "on",
        publishToDiscord: formData.get("publishToDiscord") === "on",
        publishToWhatsApp: formData.get("publishToWhatsApp") === "on",
      },
    });

    const imageChanged = previousImageUrl !== nextImageUrl;

    if (imageChanged && isLocalEventImage(previousImageUrl)) {
      await deleteLocalEventImage(previousImageUrl);
    }
  } catch (error) {
    await logServerError("UPDATE_EVENT_ERROR", error);
    if (uploadedLocalImageUrl) {
      await deleteLocalEventImage(uploadedLocalImageUrl);
    }

    if (error instanceof Error) {
      if (error.message === "INVALID_IMAGE_TYPE") {
        redirect("/admin/events?error=image_type");
      }

      if (error.message === "IMAGE_TOO_LARGE") {
        redirect("/admin/events?error=image_size");
      }

      if (error.message === "INVALID_IMAGE_URL") {
        redirect("/admin/events?error=image_url");
      }
    }

    redirect("/admin/events?error=server");
  }

  redirect("/admin/events?updated=1");
}