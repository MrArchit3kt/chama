import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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

        if (user.status === "BANNED") {
          throw new Error("ACCOUNT_BANNED");
        }

        if (user.registrationStatus === "PENDING") {
          throw new Error("ACCOUNT_PENDING_APPROVAL");
        }

        if (user.registrationStatus === "REJECTED") {
          throw new Error("ACCOUNT_REJECTED");
        }

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