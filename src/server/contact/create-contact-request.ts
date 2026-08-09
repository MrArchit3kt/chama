"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { ContactRequestType } from "@/generated/prisma/enums";

const CONTACT_REQUEST_TYPES = new Set<string>(Object.values(ContactRequestType));

export async function createContactRequest(formData: FormData) {
  const user = await requireAuth();

  if (!user) {
    redirect("/login");
  }

  if (!rateLimit(`contact:${user.id}`, 10, 60 * 60 * 1000)) {
    redirect("/contact?error=rate_limit");
  }

  const type = String(formData.get("type") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!type || !subject || !message || !CONTACT_REQUEST_TYPES.has(type)) {
    redirect("/contact?error=validation");
  }

  try {
    await db.contactRequest.create({
      data: {
        userId: user.id,
        type: type as ContactRequestType,
        subject,
        message,
      },
    });

    const admins = await db.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "SUPER_ADMIN"],
        },
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "INFO",
          channel: "IN_APP",
          status: "PENDING",
          title: "Nouvelle demande de contact",
          message: `${user.name ?? "Un utilisateur"} a envoyé une demande : ${subject}`,
        })),
      });
    }
  } catch (error) {
    console.error("CREATE_CONTACT_REQUEST_ERROR", error);
    redirect("/contact?error=server");
  }

  redirect("/contact?success=1");
}