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

type Game = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE";

function isGame(value: string): value is Game {
  return value === "WARZONE" || value === "WARZONE_RANKED" || value === "BO7" || value === "ROCKET_LEAGUE";
}

export async function createDiscordVoiceChannel(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const rawGame = String(formData.get("game") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();

  if (!isGame(rawGame) || !label || !/^\d{5,25}$/.test(channelId)) {
    redirect("/admin/discord?error=validation");
  }

  const game = rawGame;

  try {
    await db.discordVoiceChannel.create({
      data: { game, label, channelId },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("CREATE_DISCORD_VOICE_CHANNEL_ERROR", error);
    redirect("/admin/discord?error=server");
  }

  redirect("/admin/discord?success=1");
}
