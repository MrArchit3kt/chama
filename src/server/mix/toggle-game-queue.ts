"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";

const ALLOWED = ["WARZONE", "WARZONE_RANKED", "BO7", "ROCKET_LEAGUE", "VERSUS"] as const;
type MixGame = (typeof ALLOWED)[number];

function gameFrom(v: unknown): MixGame | null {
  if (typeof v !== "string") return null;
  const g = v.trim().toUpperCase();
  return (ALLOWED as readonly string[]).includes(g) ? (g as MixGame) : null;
}

function backTo(game: MixGame) {
  if (game === "WARZONE") return "/warzone";
  if (game === "WARZONE_RANKED") return "/ranked";
  if (game === "BO7") return "/bo7";
  if (game === "VERSUS") return "/versus";
  return "/rocket-league";
}

export async function toggleGameQueue(formData: FormData) {
  const user = await requireAuth();
  if (!user) redirect("/login");

  const game = gameFrom(formData.get("game"));
  if (!game) redirect("/profil?error=server");

  const me = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      status: true,
      registrationStatus: true,
      isAvailableForWarzoneMix: true,
      isAvailableForWarzoneRankedMix: true,
      isAvailableForBO7Mix: true,
      isAvailableForRocketLeagueMix: true,
      isAvailableForVersusMix: true,
    },
  });

  if (!me || me.status !== "ACTIVE" || me.registrationStatus !== "APPROVED") {
    redirect(`${backTo(game)}?error=banned`);
  }

  // toggle la file choisie, et coupe toutes les autres (une seule file à la fois)
  const nextWarzone = game === "WARZONE" ? !me.isAvailableForWarzoneMix : false;
  const nextWarzoneRanked =
    game === "WARZONE_RANKED" ? !me.isAvailableForWarzoneRankedMix : false;
  const nextBO7 = game === "BO7" ? !me.isAvailableForBO7Mix : false;
  const nextRL = game === "ROCKET_LEAGUE" ? !me.isAvailableForRocketLeagueMix : false;
  const nextVersus = game === "VERSUS" ? !me.isAvailableForVersusMix : false;

  const nextGlobal = nextWarzone || nextWarzoneRanked || nextBO7 || nextRL || nextVersus;

  await db.user.update({
    where: { id: me.id },
    data: {
      isAvailableForWarzoneMix: nextWarzone,
      isAvailableForWarzoneRankedMix: nextWarzoneRanked,
      isAvailableForBO7Mix: nextBO7,
      isAvailableForRocketLeagueMix: nextRL,
      isAvailableForVersusMix: nextVersus,
      isAvailableForMix: nextGlobal,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });

  redirect(`${backTo(game)}?success=1`);
}
