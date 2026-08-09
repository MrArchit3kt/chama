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

export async function deleteDiscordVoiceChannel(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/discord?error=validation");

  try {
    await db.discordVoiceChannel.delete({ where: { id } });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_DISCORD_VOICE_CHANNEL_ERROR", error);
    redirect("/admin/discord?error=server");
  }

  redirect("/admin/discord?deleted=1");
}
