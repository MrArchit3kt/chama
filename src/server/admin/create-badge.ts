"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const createBadgeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Majuscules, chiffres et underscore uniquement"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(2).max(300),
  category: z.enum(["MEMBERSHIP", "SKILL", "ACTIVITY", "BEHAVIOR", "EVENT", "SPECIAL"]),
  icon: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(40),
});

export async function createBadge(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const parsed = createBadgeSchema.safeParse({
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? ""),
    icon: String(formData.get("icon") ?? ""),
    color: String(formData.get("color") ?? ""),
  });

  if (!parsed.success) {
    redirect("/admin/badges?error=validation");
  }

  try {
    const existing = await db.badge.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });

    if (existing) {
      redirect("/admin/badges?error=code_taken");
    }

    await db.badge.create({ data: parsed.data });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_BADGE_ERROR", error);
    redirect("/admin/badges?error=server");
  }

  redirect("/admin/badges?success=1");
}
