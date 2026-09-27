"use client";

import { useMemo, useState } from "react";
import { replaceScoreTeamMember } from "@/server/points/replace-score-team-member";

type TeamOption = {
  id: string;
  name: string;
  members: { id: string; label: string }[];
};

type EligibleUser = { id: string; displayName: string };

type TeamRosterManagerProps = {
  gameModeId: string;
  boardId: string;
  tournamentId: string;
  teams: TeamOption[];
  eligibleUsers: EligibleUser[];
};

/**
 * Contrôle unique en haut de chaque partie pour gérer la composition des
 * équipes : sélectionner une équipe, puis soit ajouter un nouveau joueur,
 * soit remplacer un membre existant par un autre — en un seul formulaire,
 * plutôt qu'une ligne « Ajouter à l'équipe » répétée sur chaque carte
 * d'équipe. Uniquement affiché tant que la partie n'est pas terminée.
 */
export function TeamRosterManager({
  gameModeId,
  boardId,
  tournamentId,
  teams,
  eligibleUsers,
}: TeamRosterManagerProps) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  const selectedTeam = useMemo(() => teams.find((t) => t.id === teamId), [teams, teamId]);

  if (teams.length === 0) return null;

  return (
    <form
      action={replaceScoreTeamMember}
      className="grid gap-2.5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
    >
      <input type="hidden" name="gameModeId" value={gameModeId} />
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <select
        name="teamId"
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="w-full px-3 py-2.5 text-sm"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <select key={teamId} name="memberId" defaultValue="" className="w-full px-3 py-2.5 text-sm">
        <option value="">+ Ajouter un nouveau joueur</option>
        {selectedTeam?.members.map((m) => (
          <option key={m.id} value={m.id}>
            Remplacer {m.label}
          </option>
        ))}
      </select>

      <select name="userId" defaultValue="" className="w-full px-3 py-2.5 text-sm">
        <option value="">Joueur inscrit (optionnel)</option>
        {eligibleUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>

      <input
        name="guestName"
        type="text"
        placeholder="Ou nom d’un invité"
        className="w-full px-3 py-2.5 text-sm"
      />

      <button type="submit" className="neon-button-secondary px-4 py-2.5 text-sm">
        Enregistrer
      </button>
    </form>
  );
}
