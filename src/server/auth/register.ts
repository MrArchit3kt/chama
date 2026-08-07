"use server";

import { hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const registerSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40),
    email: z.string().trim().email(),
    activisionId: z.string().trim().max(64).optional().or(z.literal("")),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
    acceptRules: z.literal("on"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function normalizeBaseUsername(displayName: string) {
  // -> "Pénélope CHAMA" => "penelope_chama"
  const base = displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "_") // non alphanum => _
    .replace(/^_+|_+$/g, "") // trim _
    .slice(0, 20);

  return base.length >= 3 ? base : `player_${base || "chama"}`;
}

async function makeUniqueUsername(base: string) {
  // On tente base, puis base_1234, base_5678...
  let candidate = base;
  for (let i = 0; i < 12; i += 1) {
    const exists = await db.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;

    const suffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${base}_${suffix}`.slice(0, 24);
  }
  // dernier recours
  return `${base}_${Date.now().toString().slice(-4)}`.slice(0, 24);
}

export async function registerUser(formData: FormData) {
  const ip = await getClientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    redirect("/register?error=rate_limit");
  }

  const parsed = registerSchema.safeParse({
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    activisionId: String(formData.get("activisionId") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    acceptRules: formData.get("acceptRules"),
  });

  if (!parsed.success) {
    redirect("/register?error=validation");
  }

  const data = parsed.data;
  const normalizedEmail = data.email.toLowerCase().trim();

  try {
    const existingEmail = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingEmail) redirect("/register?error=email");

    const baseUsername = normalizeBaseUsername(data.displayName);
    const username = await makeUniqueUsername(baseUsername);

    // ✅ DB exige warzoneUsername => on fallback proprement
    const activisionId = data.activisionId?.trim() || null;
    const warzoneUsername = activisionId ? activisionId : data.displayName.trim();

    const activeRules = await db.rulesVersion.findFirst({
      where: { isActive: true },
      orderBy: { versionNumber: "desc" },
      select: { id: true },
    });

    const passwordHash = await hash(data.password, 12);

    const newUser = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        displayName: data.displayName.trim(),
        username, // ✅ généré
        warzoneUsername, // ✅ fallback
        activisionId, // ✅ optionnel
        role: "PLAYER",
        status: "INACTIVE",
        registrationStatus: "PENDING",
        acceptedRulesAt: new Date(),
        acceptedRulesVersionId: activeRules?.id ?? null,
      },
    });

    // ✅ Prévenir les admins qu'une inscription attend une validation
    const admins = await db.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "INFO",
          channel: "IN_APP",
          status: "PENDING",
          title: "Nouvelle inscription à valider",
          message: `${newUser.displayName} (@${newUser.username}) attend une validation d’inscription.`,
        })),
      });
    }
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("REGISTER_ERROR", error);
    redirect("/register?error=server");
  }

  redirect("/approval-pending");
}