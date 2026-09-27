import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { computeEntryPoints } from "@/lib/scoring";
import { toCsv, csvResponse } from "@/lib/csv";

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

/** Export CSV du détail d'une partie (tableau) — utilisé depuis
 * /admin/tournaments/[id], qui gère désormais toute la saisie des scores. */
export async function GET(request: Request) {
  const admin = await requireAdmin("points");
  if (!admin) return new Response("Forbidden", { status: 403 });
  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    return new Response("Forbidden", { status: 403 });
  }

  const boardId = new URL(request.url).searchParams.get("board");
  if (!boardId) return new Response("Missing board", { status: 400 });

  const board = await db.scoreBoard.findUnique({
    where: { id: boardId },
    include: {
      gameMode: { select: { name: true } },
      teams: {
        include: {
          entries: { include: { condition: { select: conditionForScoringSelect } } },
          members: {
            include: {
              user: { select: { displayName: true, username: true } },
              entries: { include: { condition: { select: conditionForScoringSelect } } },
            },
          },
        },
      },
    },
  });

  if (!board) return new Response("Not found", { status: 404 });

  const rows: (string | number)[][] = [["Équipe", "Joueur", "Points individuels", "Points d’équipe", "Total"]];

  for (const team of board.teams) {
    const teamPoints = team.entries.reduce((sum, e) => sum + computeEntryPoints(e.quantity, e.condition), 0);

    if (team.members.length === 0) {
      rows.push([team.name, "(aucun membre)", 0, teamPoints, teamPoints]);
      continue;
    }

    for (const member of team.members) {
      const label = member.user ? member.user.displayName : member.guestName ?? "Invité";
      const ownPoints = member.entries.reduce(
        (sum, e) => sum + computeEntryPoints(e.quantity, e.condition),
        0,
      );
      rows.push([team.name, label, ownPoints, teamPoints, ownPoints + teamPoints]);
    }
  }

  const label = board.title || board.createdAt.toISOString().slice(0, 10);
  const filename = `${board.gameMode.name}-${label}.csv`.replace(/[^a-z0-9._-]+/gi, "_");

  return csvResponse(toCsv(rows), filename);
}
