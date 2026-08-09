"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { publishAdminEvent } from "@/server/admin/admin-live-events";
import { logServerError } from "@/lib/log-error";

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8).max(100),
});

export async function resetPlayerPassword(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const parsed = resetPasswordSchema.safeParse({
    userId: String(formData.get("userId") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/players?error=password_validation");
  }

  const { userId, password } = parsed.data;

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

    if (targetUser.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
      redirect("/admin/players?error=forbidden");
    }

    const passwordHash = await hash(password, 12);

    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
      },
    });

    publishAdminEvent("players");
  } catch (error) {
    await logServerError("RESET_PLAYER_PASSWORD_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?password_reset=1");
}