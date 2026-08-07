"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";

const rocketLeagueRankEnum = z.enum([
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "CHAMPION",
  "GRAND_CHAMPION",
  "SSL",
]);

const warzoneRankTierEnum = z.enum([
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "CRIMSON",
  "IRIDESCENT",
  "TOP_250",
]);

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(40),
  email: z.string().trim().email(),
  warzoneUsername: z.string().min(2).max(40),
  activisionId: z.string().max(80).optional(),
  platform: z
    .enum(["PC", "PS5", "PS4", "XBOX_SERIES", "XBOX_ONE", "OTHER"])
    .optional(),
  preferredRole: z
    .enum(["RUSH", "SUPPORT", "SNIPE", "FLEX", "IGL", "NONE"])
    .optional(),
  discordUsername: z.string().max(80).optional(),
  whatsappNumber: z.string().max(30).optional(),
  micAvailable: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),

  // ✅ Rocket League
  rocketLeagueRank: rocketLeagueRankEnum.optional(),

  // ✅ Warzone Ranked
  warzoneRankTier: warzoneRankTierEnum.optional(),
});

function emptyToUndefined(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str === "" ? undefined : str;
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function updateProfile(formData: FormData) {
  const user = await requireAuth();

  if (!user) {
    redirect("/login");
  }

  // RL rank / Warzone Ranked tier : on accepte "" => undefined
  const rlRankRaw = emptyToUndefined(formData.get("rocketLeagueRank"));
  const wzRankRaw = emptyToUndefined(formData.get("warzoneRankTier"));

  const parsed = updateProfileSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    warzoneUsername: String(formData.get("warzoneUsername") ?? ""),
    activisionId: emptyToUndefined(formData.get("activisionId")),
    platform: emptyToUndefined(formData.get("platform")),
    preferredRole: emptyToUndefined(formData.get("preferredRole")),
    discordUsername: emptyToUndefined(formData.get("discordUsername")),
    whatsappNumber: emptyToUndefined(formData.get("whatsappNumber")),
    micAvailable: formData.get("micAvailable") === "on",
    whatsappOptIn: formData.get("whatsappOptIn") === "on",

    rocketLeagueRank: rlRankRaw as any, // validé par zod enum si présent
    warzoneRankTier: wzRankRaw as any, // validé par zod enum si présent
  });

  if (!parsed.success) {
    redirect("/profil?error=validation");
  }

  try {
    const data = parsed.data;
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingEmail = await db.user.findFirst({
      where: { email: normalizedEmail, id: { not: user.id } },
      select: { id: true },
    });
    if (existingEmail) {
      redirect("/profil?error=email_taken");
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        displayName: data.displayName.trim(),
        email: normalizedEmail,
        warzoneUsername: data.warzoneUsername.trim(),
        activisionId: data.activisionId,
        platform: data.platform,
        preferredRole: data.preferredRole ?? "NONE",
        discordUsername: data.discordUsername,
        whatsappNumber: data.whatsappNumber,
        micAvailable: Boolean(data.micAvailable),
        whatsappOptIn: Boolean(data.whatsappOptIn),

        // ✅ Rocket League
        rocketLeagueRank: data.rocketLeagueRank ?? null,

        // ✅ Warzone Ranked
        warzoneRankTier: data.warzoneRankTier ?? null,
      },
    });
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("UPDATE_PROFILE_ERROR", error);
    redirect("/profil?error=server");
  }

  redirect("/profil?success=1");
}