import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/lib/prisma";
import { exchangeDiscordCode } from "@/lib/discord";
import { logServerError } from "@/lib/log-error";

const STATE_COOKIE = "discord_oauth_state";

function siteUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return new URL(path, base);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(siteUrl("/login"));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (oauthError) {
    return NextResponse.redirect(siteUrl("/profil?error=discord_denied"));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(siteUrl("/profil?error=discord_state"));
  }

  const discordUser = await exchangeDiscordCode(code);
  if (!discordUser) {
    return NextResponse.redirect(siteUrl("/profil?error=discord_exchange"));
  }

  try {
    const existing = await db.user.findUnique({
      where: { discordUserId: discordUser.id },
      select: { id: true },
    });

    if (existing && existing.id !== user.id) {
      return NextResponse.redirect(siteUrl("/profil?error=discord_taken"));
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        discordUserId: discordUser.id,
        discordUsername: discordUser.global_name ?? discordUser.username,
      },
    });
  } catch (error) {
    await logServerError("DISCORD_LINK_ERROR", error);
    return NextResponse.redirect(siteUrl("/profil?error=discord_exchange"));
  }

  return NextResponse.redirect(siteUrl("/profil?discord=connected"));
}
