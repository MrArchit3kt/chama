"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { getSessionUser } from "@/server/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/log-error";

const BAN_APPEAL_SUBJECT = "Contestation de bannissement";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Permet à un joueur banni de s'expliquer directement depuis la page /banni.
 * Le message part dans la même file que les demandes de contact (Admin
 * Contact) avec un sujet fixe, pour que les admins le voient sans avoir à
 * créer un nouveau canal.
 *
 * ⚠️ N'utilise pas requireAuth() ici : requireAuth() redirige justement les
 * comptes bannis vers /banni, donc ça ne renverrait jamais l'utilisateur.
 */
export async function submitBanAppeal(formData: FormData) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "BANNED") {
    redirect("/acceuil");
  }

  if (!rateLimit(`ban-appeal:${user.id}`, 3, 60 * 60 * 1000)) {
    redirect("/banni?error=rate_limit");
  }

  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 10 || message.length > 3000) {
    redirect("/banni?error=validation");
  }

  try {
    await db.contactRequest.create({
      data: {
        userId: user.id,
        type: "ADMIN_REQUEST",
        subject: BAN_APPEAL_SUBJECT,
        message,
      },
    });

    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "INFO",
          channel: "IN_APP",
          status: "PENDING",
          title: "Contestation de bannissement",
          message: `${user.name} conteste son bannissement, va voir sa demande dans Contact.`,
        })),
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("SUBMIT_BAN_APPEAL_ERROR", error);
    redirect("/banni?error=server");
  }

  redirect("/banni?success=1");
}
