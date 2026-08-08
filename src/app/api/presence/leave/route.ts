import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/lib/prisma";

export async function POST() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      isOnline: false,
      lastSeenAt: new Date(),
    },
  });

  // ⚠️ Si cet utilisateur était désigné générateur (prioritaire) sur un ou
  // plusieurs jeux, on libère le verrou : sinon la file resterait bloquée
  // indéfiniment (plus personne ne pourrait générer ni gérer le pool) tant
  // qu'un autre admin ne vient pas le déverrouiller manuellement.
  await db.mixGenerationLock.updateMany({
    where: { selectedUserId: user.id },
    data: { selectedUserId: null },
  });

  return NextResponse.json({ ok: true });
}