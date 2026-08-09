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

export async function revokeBadge(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const userId = String(formData.get("userId") ?? "").trim();
  const badgeId = String(formData.get("badgeId") ?? "").trim();

  if (!userId || !badgeId) {
    redirect("/admin/players?error=validation");
  }

  try {
    await db.userBadge.delete({
      where: { userId_badgeId: { userId, badgeId } },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REVOKE_BADGE_ERROR", error);
    redirect("/admin/players?error=server");
  }

  redirect("/admin/players?badge_revoked=1");
}
