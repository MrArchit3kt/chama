"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminPermission } from "@/lib/admin-permissions";

const SITE_THEMES = [
  "DEFAULT",
  "HALLOWEEN",
  "CHRISTMAS",
  "PINK_OCTOBER",
  "OCEAN",
  "EMERALD",
  "AMETHYST",
  "CRIMSON",
  "ICE",
  "SUNSET",
  "INDIGO",
  "SILVER",
  "NEON",
] as const;

export async function saveSiteConfig(formData: FormData) {
  const admin = await requireAdmin("settings");

  if (!admin) {
    redirect("/dashboard");
  }

  if (!hasAdminPermission(admin.role, admin.adminPermissions, "settings.manage")) {
    redirect("/admin/settings?error=forbidden");
  }

  const siteName = String(formData.get("siteName") ?? "").trim();
  const homeHeadline = String(formData.get("homeHeadline") ?? "").trim();
  const homeDescription = String(formData.get("homeDescription") ?? "").trim();
  const homeHeroImageUrl = String(formData.get("homeHeroImageUrl") ?? "").trim();
  const discordInviteUrl = String(formData.get("discordInviteUrl") ?? "").trim();
  const whatsappInviteUrl = String(formData.get("whatsappInviteUrl") ?? "").trim();
  const themeRaw = String(formData.get("theme") ?? "DEFAULT").trim();
  const theme = SITE_THEMES.includes(themeRaw as (typeof SITE_THEMES)[number])
    ? (themeRaw as (typeof SITE_THEMES)[number])
    : "DEFAULT";

  if (!siteName || !homeHeadline || !homeDescription) {
    redirect("/admin/settings?error=validation");
  }

  try {
    await db.siteConfig.upsert({
      where: { id: "main" },
      update: {
        siteName,
        homeHeadline,
        homeDescription,
        homeHeroImageUrl: homeHeroImageUrl || null,
        discordInviteUrl: discordInviteUrl || null,
        whatsappInviteUrl: whatsappInviteUrl || null,
        socialsEnabled: formData.get("socialsEnabled") === "on",
        eventsEnabled: formData.get("eventsEnabled") === "on",
        contactEnabled: formData.get("contactEnabled") === "on",
        registrationsEnabled: formData.get("registrationsEnabled") === "on",
        warzoneMixEnabled: formData.get("warzoneMixEnabled") === "on",
        warzoneRankedMixEnabled: formData.get("warzoneRankedMixEnabled") === "on",
        bo7MixEnabled: formData.get("bo7MixEnabled") === "on",
        rocketLeagueMixEnabled: formData.get("rocketLeagueMixEnabled") === "on",
        versusMixEnabled: formData.get("versusMixEnabled") === "on",
        theme,
      },
      create: {
        id: "main",
        siteName,
        homeHeadline,
        homeDescription,
        homeHeroImageUrl: homeHeroImageUrl || null,
        discordInviteUrl: discordInviteUrl || null,
        whatsappInviteUrl: whatsappInviteUrl || null,
        socialsEnabled: formData.get("socialsEnabled") === "on",
        eventsEnabled: formData.get("eventsEnabled") === "on",
        contactEnabled: formData.get("contactEnabled") === "on",
        registrationsEnabled: formData.get("registrationsEnabled") === "on",
        warzoneMixEnabled: formData.get("warzoneMixEnabled") === "on",
        warzoneRankedMixEnabled: formData.get("warzoneRankedMixEnabled") === "on",
        bo7MixEnabled: formData.get("bo7MixEnabled") === "on",
        rocketLeagueMixEnabled: formData.get("rocketLeagueMixEnabled") === "on",
        versusMixEnabled: formData.get("versusMixEnabled") === "on",
        theme,
      },
    });

    // ✅ SiteConfig (thème, visibilité des onglets mix...) est lu par le
    // layout racine et par SiteShell sur TOUTE page — sans ça, une page déjà
    // visitée dans la session (cache de navigation côté client de Next)
    // peut continuer à afficher l'ancien état jusqu'à sa propre expiration.
    revalidatePath("/", "layout");

    await logActivity({
      action: "SITE_CONFIG_UPDATED",
      actorId: admin.id,
      actorLabel: `${admin.name} (@${admin.username})`,
      targetLabel: siteName,
    });
  } catch (error) {
    await logServerError("SAVE_SITE_CONFIG_ERROR", error);
    redirect("/admin/settings?error=server");
  }

  redirect("/admin/settings?success=1");
}