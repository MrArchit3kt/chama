"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

/** Vide entièrement l'historique des erreurs journalisées. */
export async function purgeErrorLogs() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  try {
    await db.errorLog.deleteMany({});
  } catch (error) {
    await logServerError("PURGE_ERROR_LOGS_ERROR", error);
    redirect("/admin/errors?error=server");
  }

  redirect("/admin/errors?purged=1");
}
