"use server";

import { redirect } from "next/navigation";
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

export async function toggleAuraMember(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const nextValue = String(formData.get("nextValue") ?? "").trim();

  if (!userId || (nextValue !== "true" && nextValue !== "false")) {
    redirect("/admin/players?error=validation");
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: {
        isAuraMember: nextValue === "true",
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;

    await logServerError("TOGGLE_AURA_MEMBER_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect(`/admin/players?aura=${nextValue === "true" ? "1" : "0"}`);
}
