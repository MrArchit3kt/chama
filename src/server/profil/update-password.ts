"use server";

import { redirect } from "next/navigation";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export async function updatePassword(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const parsed = updatePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    redirect("/profil?error=password_validation");
  }

  try {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });

    if (!dbUser) redirect("/profil?error=server");

    const isValid = await compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!isValid) {
      redirect("/profil?error=password_mismatch");
    }

    const passwordHash = await hash(parsed.data.newPassword, 12);

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error("UPDATE_PASSWORD_ERROR", error);
    redirect("/profil?error=server");
  }

  redirect("/profil?password_success=1");
}
