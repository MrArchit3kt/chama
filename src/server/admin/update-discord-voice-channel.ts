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

export async function updateDiscordVoiceChannel(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();

  if (!id || !label || !/^\d{5,25}$/.test(channelId)) {
    redirect("/admin/discord?error=validation");
  }

  try {
    const existing = await db.discordVoiceChannel.findUnique({ where: { id }, select: { id: true } });
    if (!existing) redirect("/admin/discord?error=server");

    await db.discordVoiceChannel.update({
      where: { id },
      data: { label, channelId },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("UPDATE_DISCORD_VOICE_CHANNEL_ERROR", error);
    redirect("/admin/discord?error=server");
  }

  redirect("/admin/discord?updated=1");
}
