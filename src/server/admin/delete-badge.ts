"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function deleteBadge(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/badges?error=server");

  try {
    // onDelete: Cascade sur UserBadge => retire aussi le badge des joueurs qui l'avaient
    await db.badge.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("DELETE_BADGE_ERROR", error);
    redirect("/admin/badges?error=server");
  }

  redirect("/admin/badges?deleted=1");
}
