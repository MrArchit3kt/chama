"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

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
  const admin = await requireAdmin("discord");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "discord.manage")) {
    redirect("/admin/discord?error=forbidden");
  }

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

    await logActivity({
      action: "DISCORD_CHANNEL_UPDATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: label,
      metadata: { channelId },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("UPDATE_DISCORD_VOICE_CHANNEL_ERROR", error);
    redirect("/admin/discord?error=server");
  }

  redirect("/admin/discord?updated=1");
}
