"use client";

import { useMemo, useState } from "react";
import { generateRandomTeams } from "@/server/points/generate-random-teams";

type DrawUser = { id: string; displayName: string; interested: boolean };

type RandomDrawFormProps = {
  tournamentId: string;
  initialTeamCount: number;
  initialMaxMembersPerTeam: number | null;
  users: DrawUser[];
};

/**
 * Formulaire de tirage au sort avec compteur en direct : nombre de joueurs
 * sélectionnés (inscrits cochés + invités saisis) et, si une capacité max
 * par équipe est renseignée, combien de places restent avant d'atteindre
 * `teamCount × maxMembersPerTeam` — ou de combien on la dépasse (auto-ajusté
 * côté serveur, voir generate-random-teams.ts, mais utile de le voir venir).
 */
export function RandomDrawForm({
  tournamentId,
  initialTeamCount,
  initialMaxMembersPerTeam,
  users,
}: RandomDrawFormProps) {
  const [teamCount, setTeamCount] = useState(initialTeamCount);
  const [maxMembersPerTeam, setMaxMembersPerTeam] = useState<number | "">(
    initialMaxMembersPerTeam ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(users.filter((u) => u.interested).map((u) => u.id)),
  );
  const [guestNames, setGuestNames] = useState("");

  const guestCount = useMemo(
    () => guestNames.split("\n").map((l) => l.trim()).filter(Boolean).length,
    [guestNames],
  );

  const selectedCount = selectedIds.size + guestCount;
  const capacity = maxMembersPerTeam === "" ? null : teamCount * Number(maxMembersPerTeam);
  const remaining = capacity !== null ? capacity - selectedCount : null;

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={generateRandomTeams} className="mt-4 grid gap-4">
      <input type="hidden" name="tournamentId" value={tournamentId} />

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-white/70">
            Nombre d’équipes
          </label>
          <input
            name="teamCount"
            type="number"
            min={2}
            max={20}
            required
            value={teamCount}
            onChange={(e) => setTeamCount(Number(e.target.value) || 0)}
            className="w-full px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-white/70">
            Joueurs max par équipe (optionnel)
          </label>
          <input
            name="maxMembersPerTeam"
            type="number"
            min={1}
            max={50}
            value={maxMembersPerTeam}
            onChange={(e) => setMaxMembersPerTeam(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-semibold text-white">
            Joueurs inscrits à inclure dans le tirage
          </label>
          <span className="neon-badge text-[11px]">
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
            {capacity !== null
              ? remaining! >= 0
                ? ` · ${remaining} place${remaining! > 1 ? "s" : ""} restante${remaining! > 1 ? "s" : ""}`
                : ` · ${-remaining!} de trop (équipe${-remaining! > 1 ? "s" : ""} ajoutée${-remaining! > 1 ? "s" : ""} automatiquement)`
              : ""}
          </span>
        </div>
        <p className="neon-text-muted mb-2 text-xs">
          Les joueurs ayant répondu « Je participe » au sondage sur /points sont pré-cochés et
          remontés en tête de liste.
        </p>
        {users.length === 0 ? (
          <p className="neon-text-muted text-sm">Aucun joueur éligible.</p>
        ) : (
          <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl border border-white/8 bg-white/2 p-3 md:grid-cols-3">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  name="userIds"
                  value={u.id}
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="h-4 w-4"
                />
                {u.displayName}
                {u.interested ? <span className="text-cyan-300">🙋</span> : null}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Joueurs invités à inclure (optionnel, un nom par ligne)
        </label>
        <textarea
          name="guestNames"
          rows={3}
          value={guestNames}
          onChange={(e) => setGuestNames(e.target.value)}
          placeholder={"Kevin\nSarah\n..."}
          className="w-full px-4 py-3"
        />
      </div>

      <div>
        <button type="submit" className="neon-button px-5 py-2.5">
          Générer les équipes
        </button>
      </div>
    </form>
  );
}
