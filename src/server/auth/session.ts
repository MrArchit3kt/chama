import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/prisma";

// ⚠️ redirect() de Next.js fonctionne en lançant une erreur spéciale pour
// interrompre le rendu. Il ne faut jamais l'avaler dans un try/catch, sinon
// la redirection est silencieusement annulée (bug constaté en conditions
// réelles : /approval-pending, /approval-rejected et /banni tombaient en
// boucle de redirection au lieu de s'afficher).
function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

type SessionUser = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  status: string;
  registrationStatus: string;
};

async function resolveSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const sessionUser = session.user as { id?: string };

  if (!sessionUser.id) {
    return null;
  }

  const dbUser = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      role: true,
      status: true,
      registrationStatus: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.displayName,
    username: dbUser.username,
    role: dbUser.role,
    status: dbUser.status,
    registrationStatus: dbUser.registrationStatus,
  };
}

export async function getSessionUser() {
  try {
    return await resolveSessionUser();
  } catch (error) {
    console.error("GET_SESSION_USER_ERROR", error);
    return null;
  }
}

export async function requireAuth() {
  try {
    const user = await resolveSessionUser();

    if (!user) {
      return null;
    }

    if (user.registrationStatus === "PENDING") {
      redirect("/approval-pending");
    }

    if (user.registrationStatus === "REJECTED") {
      redirect("/approval-rejected");
    }

    if (user.status === "BANNED") {
      redirect("/banni");
    }

    return user;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("REQUIRE_AUTH_ERROR", error);
    return null;
  }
}

/**
 * True si l'utilisateur connecté vient de devenir membre CHAMA et n'a pas
 * encore vu le pop-up de bienvenue (voir toggleChamaMember / markChamaWelcomeSeen).
 * Requête dédiée et minimale : on ne veut pas alourdir SessionUser (utilisé
 * partout) avec des champs qui ne servent qu'à ce pop-up.
 */
export async function getChamaWelcomeState(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string } | undefined)?.id;
    if (!id) return false;

    const user = await db.user.findUnique({
      where: { id },
      select: { isChamaMember: true, chamaWelcomeSeenAt: true, status: true },
    });

    return Boolean(user?.isChamaMember && !user.chamaWelcomeSeenAt && user.status === "ACTIVE");
  } catch (error) {
    console.error("GET_CHAMA_WELCOME_STATE_ERROR", error);
    return false;
  }
}

export async function requireAdmin() {
  try {
    const user = await requireAuth();

    if (!user) {
      return null;
    }

    const allowed = ["ADMIN", "SUPER_ADMIN"];

    if (!allowed.includes(user.role)) {
      return null;
    }

    return user;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("REQUIRE_ADMIN_ERROR", error);
    return null;
  }
}