import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// ⚠️ Ne pas remonter ce minimum : c'est la validation du LOGIN, elle doit
// accepter n'importe quel mot de passe déjà en base (potentiellement créé
// sous une politique plus permissive), pas la politique actuelle de création
// de mot de passe (voir min(8) dans register.ts / update-password.ts /
// reset-player-password.ts). Un mismatch bloquerait des comptes existants.
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// ⚠️ Le lock par compte (ci-dessus) ne protège pas contre un attaquant qui
// essaie beaucoup de comptes différents depuis une seule IP. Ce garde-fou
// complémentaire limite le nombre total de tentatives de connexion par IP,
// tous comptes confondus.
const MAX_LOGIN_ATTEMPTS_PER_IP = 20;
const IP_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(rawCredentials) {
        const clientIp = await getClientIp();

        if (!rateLimit(`login-ip:${clientIp}`, MAX_LOGIN_ATTEMPTS_PER_IP, IP_RATE_LIMIT_WINDOW_MS)) {
          throw new Error("RATE_LIMITED");
        }

        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          select: {
            id: true,
            email: true,
            displayName: true,
            username: true,
            passwordHash: true,
            role: true,
            status: true,
            registrationStatus: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        });

        if (!user) {
          return null;
        }

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        if (user.registrationStatus === "PENDING") {
          throw new Error("ACCOUNT_PENDING_APPROVAL");
        }

        if (user.registrationStatus === "REJECTED") {
          throw new Error("ACCOUNT_REJECTED");
        }

        // ⚠️ Un compte banni doit quand même pouvoir prouver son identité
        // (mot de passe correct) pour accéder à la page /banni où il voit
        // la raison et peut s'expliquer. On ne bloque donc pas ici : le
        // statut BANNED est renvoyé dans la session, et requireAuth()
        // redirige ensuite systématiquement vers /banni.
        const isValid = await compare(password, user.passwordHash);

        if (!isValid) {
          const nextAttempts = user.failedLoginAttempts + 1;

          if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
            await db.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
              },
            });
            throw new Error("ACCOUNT_LOCKED");
          }

          await db.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: nextAttempts },
          });

          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await db.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
          username: user.username,
          status: user.status,
          registrationStatus: user.registrationStatus,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.status = (user as any).status;
        token.registrationStatus = (user as any).registrationStatus;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = String(token.id ?? "");
        (session.user as any).role = String(token.role ?? "PLAYER");
        (session.user as any).username = String(token.username ?? "");
        (session.user as any).status = String(token.status ?? "ACTIVE");
        (session.user as any).registrationStatus = String(
          token.registrationStatus ?? "APPROVED",
        );
      }

      return session;
    },
  },
};