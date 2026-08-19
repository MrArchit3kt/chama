"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";

type MixGame = "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function gameFrom(v: unknown): MixGame {
  const g = String(v ?? "").trim().toUpperCase();
  if (g === "ROCKET_LEAGUE") return "ROCKET_LEAGUE";
  if (g === "WARZONE_RANKED") return "WARZONE_RANKED";
  if (g === "BO7") return "BO7";
  if (g === "VERSUS") return "VERSUS";
  return "WARZONE";
}

function backTo(game: MixGame) {
  if (game === "ROCKET_LEAGUE") return "/admin/mix/rocket-league";
  if (game === "WARZONE_RANKED") return "/admin/mix/warzone-ranked";
  if (game === "BO7") return "/admin/mix/bo7";
  if (game === "VERSUS") return "/admin/mix/versus";
  return "/admin/mix/warzone";
}

export async function removePlayerFromPool(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const game = gameFrom(formData.get("game"));
  const userId = String(formData.get("userId") ?? "").trim();
  const tempPlayerId = String(formData.get("tempPlayerId") ?? "").trim();

  if (!userId && !tempPlayerId) redirect(`${backTo(game)}?error=server`);

  try {
    if (userId) {
      if (game === "ROCKET_LEAGUE") {
        await db.user.update({
          where: { id: userId },
          data: { isAvailableForRocketLeagueMix: false, isOnline: false },
        });
      } else if (game === "WARZONE_RANKED") {
        await db.user.update({
          where: { id: userId },
          data: { isAvailableForWarzoneRankedMix: false, isOnline: false },
        });
      } else if (game === "BO7") {
        await db.user.update({
          where: { id: userId },
          data: { isAvailableForBO7Mix: false, isOnline: false },
        });
      } else if (game === "VERSUS") {
        await db.user.update({
          where: { id: userId },
          data: { isAvailableForVersusMix: false, isOnline: false },
        });
      } else {
        await db.user.update({
          where: { id: userId },
          data: { isAvailableForWarzoneMix: false, isOnline: false },
        });
      }
    } else {
      // ✅ IMPORTANT: retire uniquement sur le bon jeu
      const res = await db.tempPlayer.updateMany({
        where: { id: tempPlayerId, game },
        data: { isAvailableForMix: false },
      });

      if (res.count === 0) {
        redirect(`${backTo(game)}?error=server`);
      }
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REMOVE_PLAYER_FROM_POOL_ERROR", error);
    redirect(`${backTo(game)}?error=server`);
  }

  redirect(`${backTo(game)}?removed=1`);
}