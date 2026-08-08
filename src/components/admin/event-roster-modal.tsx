"use client";

import { useState } from "react";
import { X, Users } from "lucide-react";
import { setEventRoster } from "@/server/events/set-event-roster";

type Candidate = {
  id: string;
  displayName: string;
  username: string;
};

type EventRosterModalProps = {
  eventId: string;
  role: "TITULAIRE" | "REMPLACANT";
  label: string;
  candidates: Candidate[];
  selectedIds: string[];
  accentClassName: string;
};

/**
 * Pop-up de sélection des titulaires (ou des remplaçants) d'un événement.
 * Une checkbox par joueur, coché = a ce rôle. Les deux rôles (titulaire /
 * remplaçant) sont gérés par deux instances indépendantes de ce composant.
 */
export function EventRosterModal({
  eventId,
  role,
  label,
  candidates,
  selectedIds,
  accentClassName,
}: EventRosterModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-80 ${accentClassName}`}
      >
        <Users className="h-4 w-4" />
        {label} ({selectedIds.length})
      </button>

      {open ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <div className="neon-card relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden p-0">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 p-4">
              <h3 className="text-base font-bold text-white">
                Sélectionner les {label.toLowerCase()}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/60 transition hover:border-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              action={setEventRoster}
              onSubmit={() => setOpen(false)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="role" value={role} />

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {candidates.length === 0 ? (
                  <p className="neon-text-muted text-sm">
                    Aucun joueur disponible pour le moment.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {candidates.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/2 p-3 transition hover:border-cyan-400/20"
                      >
                        <input
                          type="checkbox"
                          name="userIds"
                          value={c.id}
                          defaultChecked={selectedIds.includes(c.id)}
                          className="h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {c.displayName}
                          </p>
                          <p className="neon-text-muted truncate text-xs">@{c.username}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-white/8 p-4">
                <button type="submit" className="neon-button w-full px-4 py-2.5">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
