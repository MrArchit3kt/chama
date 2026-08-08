import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth/session";
import { getDiscordAuthorizeUrl, isDiscordOAuthConfigured } from "@/lib/discord";

const STATE_COOKIE = "discord_oauth_state";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "http://localhost:3000"));
  }

  if (!isDiscordOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/profil?error=discord_not_configured", process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const authorizeUrl = getDiscordAuthorizeUrl(state);

  if (!authorizeUrl) {
    return NextResponse.redirect(
      new URL("/profil?error=discord_not_configured", process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(authorizeUrl);
}
