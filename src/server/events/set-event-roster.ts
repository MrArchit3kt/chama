"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";

type RosterRole = "TITULAIRE" | "REMPLACANT";

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function isRosterRole(value: string): value is RosterRole {
  return value === "TITULAIRE" || value === "REMPLACANT";
}

/**
 * Définit la liste exacte des titulaires (ou des remplaçants) d'un
 * événement : les joueurs cochés dans le pop-up reçoivent ce rôle, ceux qui
 * l'avaient et ne sont plus cochés le perdent. Les deux rôles sont
 * indépendants (chaque pop-up ne touche que le sien).
 */
export async function setEventRoster(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const eventId = String(formData.get("eventId") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "").trim();

  if (!eventId || !isRosterRole(rawRole)) {
    redirect("/admin/events?error=validation");
  }

  const role = rawRole;
  const userIds = [...new Set(formData.getAll("userIds").map(String).filter(Boolean))];

  try {
    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) redirect("/admin/events?error=server");

    await db.$transaction([
      // Retire ce rôle à ceux qui ne sont plus cochés.
      db.eventParticipant.updateMany({
        where: { eventId, rosterRole: role, userId: { notIn: userIds } },
        data: { rosterRole: null },
      }),
      // Attribue ce rôle à chaque joueur coché (crée l'inscription si besoin).
      ...userIds.map((userId) =>
        db.eventParticipant.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: { eventId, userId, rosterRole: role, status: "REGISTERED" },
          update: { rosterRole: role },
        }),
      ),
    ]);
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("SET_EVENT_ROSTER_ERROR", error);
    redirect("/admin/events?error=server");
  }

  redirect("/admin/events?roster_updated=1");
}
