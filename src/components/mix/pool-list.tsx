import { removePlayerFromPoolSelfServe } from "@/server/mix/remove-from-pool-self-serve";

export type PoolPlayer = {
  id: string;
  kind: "USER" | "TEMP";
  label: string;
  sub?: string;
  isSelf?: boolean;
};

type PoolListProps = {
  game: "WARZONE" | "WARZONE_RANKED" | "BO7" | "ROCKET_LEAGUE" | "VERSUS";
  players: PoolPlayer[];
  canManage: boolean;
  managingAdminName?: string | null;
};

/**
 * Liste des joueurs actuellement dans la file d'un jeu. Si `canManage` est
 * vrai (aucun admin en ligne, ou joueur désigné générateur), chaque joueur
 * peut être retiré — utile pour débloquer une génération quand quelqu'un
 * est resté coincé dans la file (AFK, oubli).
 */
export function PoolList({ game, players, canManage, managingAdminName }: PoolListProps) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
          Joueurs dans la file ({players.length})
        </p>

        {!canManage && players.length > 0 ? (
          <span className="text-[11px] text-white/45">
            {managingAdminName
              ? `${managingAdminName} gère la file : seul lui peut retirer un joueur.`
              : "Un admin gère la file : seul lui peut retirer un joueur."}
          </span>
        ) : null}
      </div>

      {players.length === 0 ? (
        <p className="neon-text-muted mt-3 text-sm">Aucun joueur dans la file pour le moment.</p>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {players.map((p) => (
            <div
              key={p.id}
              className={
                p.isSelf
                  ? "neon-card-soft border border-cyan-400/30 p-3"
                  : "neon-card-soft p-3"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-white">{p.label}</p>
                {p.kind === "TEMP" ? (
                  <span className="neon-badge shrink-0 text-[9px]">INVITÉ</span>
                ) : p.isSelf ? (
                  <span className="neon-badge shrink-0 text-[9px]">TOI</span>
                ) : null}
              </div>

              {p.sub ? (
                <p className="neon-text-muted mt-1 truncate text-[11px]">{p.sub}</p>
              ) : null}

              {canManage ? (
                <form action={removePlayerFromPoolSelfServe} className="mt-2.5">
                  <input type="hidden" name="game" value={game} />
                  {p.kind === "USER" ? (
                    <input type="hidden" name="userId" value={p.id} />
                  ) : (
                    <input type="hidden" name="tempPlayerId" value={p.id} />
                  )}
                  <button
                    type="submit"
                    className="neon-button-secondary w-full px-3 py-1.5 text-xs"
                  >
                    Retirer
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
