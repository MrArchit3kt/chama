"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";

export async function saveSiteConfig(formData: FormData) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect("/dashboard");
  }

  const siteName = String(formData.get("siteName") ?? "").trim();
  const homeHeadline = String(formData.get("homeHeadline") ?? "").trim();
  const homeDescription = String(formData.get("homeDescription") ?? "").trim();
  const homeHeroImageUrl = String(formData.get("homeHeroImageUrl") ?? "").trim();
  const discordInviteUrl = String(formData.get("discordInviteUrl") ?? "").trim();
  const whatsappInviteUrl = String(formData.get("whatsappInviteUrl") ?? "").trim();

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
      },
    });
  } catch (error) {
    console.error("SAVE_SITE_CONFIG_ERROR", error);
    redirect("/admin/settings?error=server");
  }

  redirect("/admin/settings?success=1");
}