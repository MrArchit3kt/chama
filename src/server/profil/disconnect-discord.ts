"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/session";

export async function disconnectDiscord() {
  const user = await requireAuth();
  if (!user) redirect("/login");

  try {
    await db.user.update({
      where: { id: user.id },
      data: { discordUserId: null, discordUsername: null },
    });
  } catch (error) {
    console.error("DISCONNECT_DISCORD_ERROR", error);
    redirect("/profil?error=server");
  }

  redirect("/profil?discord=disconnected");
}
