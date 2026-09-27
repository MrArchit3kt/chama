import { db } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { computeTournamentStandings } from "@/lib/tournament-standings";
import { toCsv, csvResponse } from "@/lib/csv";

const conditionForScoringSelect = {
  points: true,
  mode: true,
  tiers: { select: { minValue: true, maxValue: true, points: true } },
} as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

export async function GET(request: Request) {
  const admin = await requireAdmin("points");
  if (!admin) return new Response("Forbidden", { status: 403 });
  if (!hasAdminPermission(admin.role, admin.adminPermissions, "points.board")) {
    return new Response("Forbidden", { status: 403 });
  }

  const tournamentId = new URL(request.url).searchParams.get("id");
  if (!tournamentId) return new Response("Missing id", { status: 400 });

  const tournament = await db.scoreTournament.findUnique({
    where: { id: tournamentId },
    include: {
      boards: {
        orderBy: { createdAt: "asc" },
        include: {
          gameMode: { select: { name: true } },
          teams: {
            include: {
              entries: { include: { condition: { select: conditionForScoringSelect } } },
              members: {
                include: { entries: { include: { condition: { select: conditionForScoringSelect } } } },
              },
            },
          },
        },
      },
    },
  });

  if (!tournament) return new Response("Not found", { status: 404 });

  const standings = computeTournamentStandings(tournament.boards);

  const rows: (string | number)[][] = [
    ["Classement", "Équipe", "Partie", "Points de la partie", "Total tournoi"],
  ];

  standings.forEach((row, rank) => {
    if (row.breakdown.length === 0) {
      rows.push([rank + 1, row.name, "", "", row.total]);
      return;
    }

    row.breakdown.forEach((b, i) => {
      const gameLabel = b.title ? `${b.gameModeName} — ${b.title}` : `${b.gameModeName} (${formatDate(b.createdAt)})`;
      rows.push([i === 0 ? rank + 1 : "", i === 0 ? row.name : "", gameLabel, b.points, i === 0 ? row.total : ""]);
    });
  });

  const filename = `tournoi-${tournament.name}.csv`.replace(/[^a-z0-9._-]+/gi, "_");

  return csvResponse(toCsv(rows), filename);
}
