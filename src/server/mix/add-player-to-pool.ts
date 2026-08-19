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

export async function addPlayerToPool(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const game = gameFrom(formData.get("game"));
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirect(`${backTo(game)}?error=server`);

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, registrationStatus: true },
    });

    if (!user || user.status !== "ACTIVE" || user.registrationStatus !== "APPROVED") {
      redirect(`${backTo(game)}?error=server`);
    }

    if (game === "ROCKET_LEAGUE") {
      await db.user.update({
        where: { id: user.id },
        data: {
          isAvailableForRocketLeagueMix: true,
          isAvailableForWarzoneMix: false,
          isAvailableForWarzoneRankedMix: false,
          isAvailableForBO7Mix: false,
          isAvailableForVersusMix: false,
        },
      });
    } else if (game === "WARZONE_RANKED") {
      await db.user.update({
        where: { id: user.id },
        data: {
          isAvailableForWarzoneRankedMix: true,
          isAvailableForWarzoneMix: false,
          isAvailableForBO7Mix: false,
          isAvailableForRocketLeagueMix: false,
          isAvailableForVersusMix: false,
        },
      });
    } else if (game === "BO7") {
      await db.user.update({
        where: { id: user.id },
        data: {
          isAvailableForBO7Mix: true,
          isAvailableForWarzoneMix: false,
          isAvailableForWarzoneRankedMix: false,
          isAvailableForRocketLeagueMix: false,
          isAvailableForVersusMix: false,
        },
      });
    } else if (game === "VERSUS") {
      await db.user.update({
        where: { id: user.id },
        data: {
          isAvailableForVersusMix: true,
          isAvailableForWarzoneMix: false,
          isAvailableForWarzoneRankedMix: false,
          isAvailableForBO7Mix: false,
          isAvailableForRocketLeagueMix: false,
        },
      });
    } else {
      await db.user.update({
        where: { id: user.id },
        data: {
          isAvailableForWarzoneMix: true,
          isAvailableForWarzoneRankedMix: false,
          isAvailableForBO7Mix: false,
          isAvailableForRocketLeagueMix: false,
          isAvailableForVersusMix: false,
        },
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("ADD_PLAYER_TO_POOL_ERROR", error);
    redirect(`${backTo(game)}?error=server`);
  }

  redirect(`${backTo(game)}?added=1`);
}