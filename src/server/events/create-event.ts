"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import {
  deleteLocalEventImage,
  resolveEventImageInput,
} from "@/server/events/_event-image";

const createEventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  eventDate: z.string().min(1),
  endDate: z.string().optional(),
  publishToDiscord: z.boolean().optional(),
  publishToWhatsApp: z.boolean().optional(),
  publishInApp: z.boolean().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createEvent(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const parsed = createEventSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    eventDate: String(formData.get("eventDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    publishToDiscord: formData.get("publishToDiscord") === "on",
    publishToWhatsApp: formData.get("publishToWhatsApp") === "on",
    publishInApp: formData.get("publishInApp") === "on",
  });

  if (!parsed.success) {
    redirect("/admin/events?error=validation");
  }

  const data = parsed.data;

  const startDate = new Date(data.eventDate);
  const finalEndDate = data.endDate ? new Date(data.endDate) : null;

  if (Number.isNaN(startDate.getTime())) {
    redirect("/admin/events?error=validation");
  }

  if (finalEndDate && Number.isNaN(finalEndDate.getTime())) {
    redirect("/admin/events?error=validation");
  }

  if (finalEndDate && finalEndDate < startDate) {
    redirect("/admin/events?error=validation");
  }

  const baseSlug = slugify(data.title);
  const uniqueSuffix = Date.now().toString().slice(-6);
  const slug = `${baseSlug}-${uniqueSuffix}`;

  let uploadedLocalImageUrl: string | null = null;

  try {
    const imageResult = await resolveEventImageInput(
      formData.get("coverImageUrl"),
      formData.get("coverImageFile"),
    );

    uploadedLocalImageUrl = imageResult.uploadedLocalImageUrl;

    const event = await db.event.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        eventDate: startDate,
        endDate: finalEndDate,
        coverImageUrl: imageResult.nextImageUrl,
        status: "PUBLISHED",
        isPublished: true,
        publishedAt: new Date(),
        publishToDiscord: Boolean(data.publishToDiscord),
        publishToWhatsApp: Boolean(data.publishToWhatsApp),
        publishInApp: data.publishInApp ?? true,
        createdById: admin.id,
      },
    });

    if (data.publishInApp ?? true) {
      const users = await db.user.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (users.length > 0) {
        await db.notification.createMany({
          data: users.map((user) => ({
            userId: user.id,
            eventId: event.id,
            type: "EVENT_PUBLISHED",
            channel: "IN_APP",
            status: "PENDING",
            title: `Nouvel événement : ${event.title}`,
            message: `Un nouvel événement a été publié pour le ${event.eventDate.toLocaleString("fr-FR")}.`,
          })),
        });
      }
    }
  } catch (error) {
    await logServerError("CREATE_EVENT_ERROR", error);
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

  redirect("/admin/events?success=1");
}