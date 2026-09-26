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

export async function deleteDiscordVoiceChannel(formData: FormData) {
  const admin = await requireAdmin("discord");
  if (!admin) redirect("/dashboard");

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "discord.manage")) {
    redirect("/admin/discord?error=forbidden");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/admin/discord?error=validation");

  try {
    const existing = await db.discordVoiceChannel.findUnique({ where: { id }, select: { label: true } });

    await db.discordVoiceChannel.delete({ where: { id } });

    await logActivity({
      action: "DISCORD_CHANNEL_DELETED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: existing?.label ?? id,
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("DELETE_DISCORD_VOICE_CHANNEL_ERROR", error);
    redirect("/admin/discord?error=server");
  }

  redirect("/admin/discord?deleted=1");
}
