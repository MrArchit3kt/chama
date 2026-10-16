import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { db } from "@/lib/prisma";
import { logServerError } from "@/lib/log-error";
import { logActivity } from "@/lib/activity-log";
import { hasAdminSectionAccess, type AdminSection } from "@/lib/admin-permissions";

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
  adminPermissions: string[];
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
      adminPermissions: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  let status = dbUser.status;

  // ✅ Exclusion temporaire (voir exclude-player.ts) : levée automatique
  // dès que l'échéance est passée, sans intervention admin. On vérifie à
  // chaque résolution de session plutôt que via un cron, pour ne pas
  // dépendre d'un process externe — le coût est négligeable (une requête
  // de plus, uniquement pour les comptes BANNED).
  if (status === "BANNED") {
    const expiredBan = await db.ban.findFirst({
      where: {
        targetUserId: dbUser.id,
        status: "ACTIVE",
        expiresAt: { lte: new Date() },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (expiredBan) {
      try {
        await db.$transaction([
          db.ban.update({
            where: { id: expiredBan.id },
            data: {
              status: "EXPIRED",
              liftedAt: new Date(),
              liftReason: "Exclusion temporaire arrivée à échéance.",
            },
          }),
          db.user.update({
            where: { id: dbUser.id },
            data: {
              status: "ACTIVE",
              bannedAt: null,
              banReason: null,
              banTriggerType: null,
            },
          }),
        ]);

        status = "ACTIVE";

        await logActivity({
          action: "PLAYER_EXCLUSION_EXPIRED",
          actorLabel: "Système (échéance automatique)",
          targetId: dbUser.id,
          targetLabel: `${dbUser.displayName} (@${dbUser.username})`,
        });
      } catch (error) {
        await logServerError("AUTO_EXPIRE_EXCLUSION_ERROR", error);
      }
    }
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.displayName,
    username: dbUser.username,
    role: dbUser.role,
    status,
    registrationStatus: dbUser.registrationStatus,
    adminPermissions: dbUser.adminPermissions,
  };
}

export async function getSessionUser() {
  try {
    return await resolveSessionUser();
  } catch (error) {
    await logServerError("GET_SESSION_USER_ERROR", error);
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
    await logServerError("REQUIRE_AUTH_ERROR", error);
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
    await logServerError("GET_CHAMA_WELCOME_STATE_ERROR", error);
    return false;
  }
}

/**
 * True si l'utilisateur connecté vient de voir son inscription validée par
 * un admin et n'a pas encore vu le pop-up de félicitations (voir
 * approveRegistration / markApprovalWelcomeSeen). Même logique dédiée que
 * getChamaWelcomeState : requête minimale, pas de champs superflus sur
 * SessionUser.
 */
export async function getApprovalWelcomeState(): Promise<boolean> {
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string } | undefined)?.id;
    if (!id) return false;

    const user = await db.user.findUnique({
      where: { id },
      select: { registrationStatus: true, approvalWelcomeSeenAt: true, status: true },
    });

    return Boolean(
      user?.registrationStatus === "APPROVED" &&
        !user.approvalWelcomeSeenAt &&
        user.status === "ACTIVE",
    );
  } catch (error) {
    await logServerError("GET_APPROVAL_WELCOME_STATE_ERROR", error);
    return false;
  }
}

/**
 * `section` optionnel : en plus d'être ADMIN/SUPER_ADMIN, vérifie que
 * l'utilisateur a accès à cette section précise (au moins une permission
 * de `admin-permissions.ts` dedans). Un SUPER_ADMIN passe toujours,
 * quelle que soit `section`. Sans `section`, se comporte comme avant
 * (n'importe quel ADMIN/SUPER_ADMIN passe) — pour les pages qui gèrent
 * elles-mêmes des permissions plus fines par bouton/formulaire.
 */
export async function requireAdmin(section?: AdminSection) {
  try {
    const user = await requireAuth();

    if (!user) {
      return null;
    }

    const allowed = ["ADMIN", "SUPER_ADMIN"];

    if (!allowed.includes(user.role)) {
      return null;
    }

    if (section && !hasAdminSectionAccess(user.role, user.adminPermissions, section)) {
      return null;
    }

    return user;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REQUIRE_ADMIN_ERROR", error);
    return null;
  }
}

/**
 * Réservé au SUPER_ADMIN (journal d'activité, gestion des permissions des
 * admins) — un ADMIN classique, même avec toutes les permissions, ne
 * passe pas ici.
 */
export async function requireSuperAdmin() {
  try {
    const user = await requireAuth();

    if (!user) {
      return null;
    }

    if (user.role !== "SUPER_ADMIN") {
      return null;
    }

    return user;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    await logServerError("REQUIRE_SUPER_ADMIN_ERROR", error);
    return null;
  }
}