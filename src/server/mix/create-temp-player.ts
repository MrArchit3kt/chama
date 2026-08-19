"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";

const RL_RANKS = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "CHAMPION",
  "GRAND_CHAMPION",
  "SSL",
] as const;

const createTempPlayerSchema = z.object({
  game: z.enum(["WARZONE", "WARZONE_RANKED", "BO7", "ROCKET_LEAGUE", "VERSUS"]).default("WARZONE"),
  nickname: z.string().trim().min(2).max(40),
  note: z.string().trim().max(200).optional(),
  rocketLeagueRank: z.enum(RL_RANKS).optional(),
});

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function backTo(game: MixGame): string {
  if (game === "WARZONE") return "/admin/mix/warzone";
  if (game === "WARZONE_RANKED") return "/admin/mix/warzone-ranked";
  if (game === "BO7") return "/admin/mix/bo7";
  if (game === "VERSUS") return "/admin/mix/versus";
  return "/admin/mix/rocket-league";
}

export async function createTempPlayer(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const rawGame = String(formData.get("game") ?? "WARZONE").trim().toUpperCase();
  const game: MixGame =
    rawGame === "ROCKET_LEAGUE"
      ? "ROCKET_LEAGUE"
      : rawGame === "WARZONE_RANKED"
        ? "WARZONE_RANKED"
        : rawGame === "BO7"
          ? "BO7"
          : rawGame === "VERSUS"
            ? "VERSUS"
            : "WARZONE";

  const parsed = createTempPlayerSchema.safeParse({
    game,
    nickname: String(formData.get("nickname") ?? ""),
    note: String(formData.get("note") ?? ""),
    rocketLeagueRank:
      String(formData.get("rocketLeagueRank") ?? "").trim().toUpperCase() || undefined,
  });

  if (!parsed.success) {
    redirect(`${backTo(game)}?error=validation`);
  }

  const nickname = parsed.data.nickname.trim();
  const note = parsed.data.note?.trim() || null;

  // ✅ RL : impose rang si les invités participent au mix RL
  if (game === "ROCKET_LEAGUE" && !parsed.data.rocketLeagueRank) {
    redirect(`${backTo(game)}?error=rank_missing`);
  }

  try {
    // Doublon temp player uniquement dans le même game ET dispo
    const existingTempPlayer = await db.tempPlayer.findFirst({
      where: {
        game,
        isAvailableForMix: true,
        nickname: { equals: nickname, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingTempPlayer) {
      redirect(`${backTo(game)}?error=nickname_taken`);
    }

    // Collision avec un user existant (global)
    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { displayName: { equals: nickname, mode: "insensitive" } },
          { username: { equals: nickname.toLowerCase(), mode: "insensitive" } },
          { warzoneUsername: { equals: nickname, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existingUser) {
      redirect(`${backTo(game)}?error=nickname_taken`);
    }

    await db.tempPlayer.create({
      data: {
        game,
        nickname,
        note,
        isAvailableForMix: true,
        rocketLeagueRank:
          game === "ROCKET_LEAGUE" ? parsed.data.rocketLeagueRank! : null,
        createdById: admin.id,
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("CREATE_TEMP_PLAYER_ERROR", error);
    redirect(`${backTo(game)}?error=server`);
  }

  redirect(`${backTo(game)}?added=1`);
}