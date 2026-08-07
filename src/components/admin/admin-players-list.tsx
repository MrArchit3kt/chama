"use client";

import { useMemo, useState } from "react";
import { addWarning } from "@/server/admin/add-warning";
import { revokeWarning } from "@/server/admin/revoke-warning";
import { liftBan } from "@/server/admin/lift-ban";
import { resetPlayerPassword } from "@/server/admin/reset-player-password";
import { toggleChamaMember } from "@/server/admin/toggle-chama-member";
import { toggleUserRole } from "@/server/admin/toggle-user-role";

type WarningItem = {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
};

type PlayerRow = {
  id: string;
  displayName: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  isChamaMember: boolean;
  inactiveDays: number | null;
  totalWarnings: number;
  activeWarnings: number;
  shouldAlert: boolean;
  warnings: WarningItem[];
};

type Props = {
  rows: PlayerRow[];
  adminRole: string;
};

function formatDate(value: Date | null) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getWarningTypeLabel(type: string) {
  switch (type) {
    case "TOXICITY":
      return "Toxicité";
    case "ABSENCE":
      return "Absence";
    case "AFK":
      return "AFK";
    case "INSULT":
      return "Insulte";
    case "CHEATING_SUSPECT":
      return "Suspicion de cheat";
    case "TEAM_REFUSAL":
      return "Refus d’équipe";
    case "SPAM":
      return "Spam";
    case "OTHER":
      return "Autre";
    default:
      return type;
  }
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return "rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-300";
    case "ADMIN":
      return "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300";
    default:
      return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/75";
  }
}

function getStatusBadgeClass(status: string) {
  if (status === "BANNED") {
    return "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300";
  }

  if (status === "ACTIVE") {
    return "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300";
  }

  return "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/75";
}

type MembershipFilter = "ALL" | "CHAMA" | "EXTERNAL";

export function AdminPlayersList({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [membershipFilter, setMembershipFilter] =
    useState<MembershipFilter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((player) => {
      const matchesSearch =
        !term ||
        player.displayName.toLowerCase().includes(term) ||
        player.username.toLowerCase().includes(term) ||
        player.email.toLowerCase().includes(term);

      const matchesRole = roleFilter === "ALL" || player.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" || player.status === statusFilter;

      const matchesMembership =
        membershipFilter === "ALL" ||
        (membershipFilter === "CHAMA" && player.isChamaMember) ||
        (membershipFilter === "EXTERNAL" && !player.isChamaMember);

      return matchesSearch && matchesRole && matchesStatus && matchesMembership;
    });
  }, [rows, search, roleFilter, statusFilter, membershipFilter]);

  return (
    <div className="grid gap-4">
      <div className="neon-card p-4 md:p-5">
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur (nom, pseudo, email)"
            className="w-full px-4 py-3"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-4 py-3"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="SUPER_ADMIN">Super admin</option>
            <option value="ADMIN">Admin</option>
            <option value="PLAYER">Player</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-3"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="BANNED">Banni</option>
            <option value="INACTIVE">Inactif</option>
          </select>

          <select
            value={membershipFilter}
            onChange={(e) =>
              setMembershipFilter(e.target.value as MembershipFilter)
            }
            className="w-full px-4 py-3"
          >
            <option value="ALL">Tous les profils</option>
            <option value="CHAMA">Membres CHAMA</option>
            <option value="EXTERNAL">Externes</option>
          </select>
        </div>

        <p className="mt-3 text-sm text-white/60">
          {filteredRows.length} joueur{filteredRows.length > 1 ? "s" : ""} affiché
          {filteredRows.length > 1 ? "s" : ""}
        </p>
      </div>

      {filteredRows.length === 0 ? (
        <div className="neon-card p-5">
          <p className="text-sm text-white/70">
            Aucun joueur ne correspond à la recherche.
          </p>
        </div>
      ) : (
        filteredRows.map((player) => {
          const isOpen = openId === player.id;

          return (
            <div key={player.id} className="neon-card overflow-hidden p-0">
              <div className="p-4 md:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-white md:text-lg">
                        {player.displayName}
                      </h3>

                      <span className="neon-badge">@{player.username}</span>
                      <span className={getRoleBadgeClass(player.role)}>
                        {player.role}
                      </span>
                      <span className={getStatusBadgeClass(player.status)}>
                        {player.status}
                      </span>

                      <span
                        className={
                          player.isChamaMember
                            ? "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"
                            : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white/70"
                        }
                      >
                        {player.isChamaMember ? "Membre CHAMA" : "Externe"}
                      </span>

                      {player.shouldAlert ? (
                        <span className="rounded-full border border-amber-400/20 bg-amber-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-300">
                          Inactif 10j+
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 truncate text-sm text-white/60">
                      {player.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="neon-card-soft min-w-[120px] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/75">
                        Connexion
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatDate(player.lastSeenAt)}
                      </p>
                    </div>

                    <div className="neon-card-soft min-w-[100px] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-pink-300/75">
                        Inactivité
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {player.inactiveDays === null
                          ? "Jamais"
                          : `${player.inactiveDays}j`}
                      </p>
                    </div>

                    <div className="neon-card-soft min-w-[110px] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/75">
                        Warnings
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {player.activeWarnings}/{player.totalWarnings}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : player.id)}
                      className="neon-button-secondary px-4 py-3"
                    >
                      {isOpen ? "▲ Replier" : "▼ Détails"}
                    </button>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <div className="border-t border-white/8 px-4 pb-4 pt-4 md:px-5 md:pb-5">
                  <div className="grid gap-4 xl:grid-cols-4">
                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Statut team CHAMA
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/75">
                        Ce joueur est actuellement{" "}
                        <span className="font-semibold text-white">
                          {player.isChamaMember
                            ? "dans la team CHAMA"
                            : "hors team CHAMA"}
                        </span>
                        .
                      </p>

                      <form action={toggleChamaMember} className="mt-3">
                        <input type="hidden" name="userId" value={player.id} />
                        <input
                          type="hidden"
                          name="nextValue"
                          value={player.isChamaMember ? "false" : "true"}
                        />

                        <button
                          type="submit"
                          className={`w-full px-5 py-3 ${
                            player.isChamaMember
                              ? "neon-button-secondary"
                              : "neon-button"
                          }`}
                        >
                          {player.isChamaMember
                            ? "Retirer de la team"
                            : "Activer membre CHAMA"}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Rôle du joueur
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/75">
                        Rôle actuel :{" "}
                        <span className="font-semibold text-white">
                          {player.role}
                        </span>
                      </p>

                      {player.role === "SUPER_ADMIN" ? (
                        <p className="mt-3 text-xs text-white/60">
                          Le rôle SUPER_ADMIN est verrouillé.
                        </p>
                      ) : (
                        <form action={toggleUserRole} className="mt-3">
                          <input type="hidden" name="userId" value={player.id} />
                          <button
                            type="submit"
                            className={`w-full px-5 py-3 ${
                              player.role === "ADMIN"
                                ? "neon-button-secondary"
                                : "neon-button"
                            }`}
                          >
                            {player.role === "ADMIN"
                              ? "Retirer admin"
                              : "Passer en admin"}
                          </button>
                        </form>
                      )}
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Réinitialiser le mot de passe
                      </p>

                      <p className="mt-2 text-sm leading-6 text-white/75">
                        Définit un mot de passe temporaire.
                      </p>

                      <form
                        action={resetPlayerPassword}
                        className="mt-3 grid gap-3"
                      >
                        <input type="hidden" name="userId" value={player.id} />

                        <input
                          name="password"
                          type="password"
                          minLength={8}
                          required
                          placeholder="Nouveau mot de passe"
                          className="w-full px-4 py-3"
                        />

                        <button
                          type="submit"
                          className="neon-button-secondary w-full px-5 py-3"
                        >
                          Modifier le mot de passe
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-300/75">
                        Ajouter un avertissement
                      </p>

                      <form action={addWarning} className="mt-3 grid gap-3">
                        <input type="hidden" name="userId" value={player.id} />

                        <select
                          name="type"
                          defaultValue="TOXICITY"
                          className="w-full px-4 py-3"
                        >
                          <option value="TOXICITY">Toxicité</option>
                          <option value="ABSENCE">Absence</option>
                          <option value="AFK">AFK</option>
                          <option value="INSULT">Insulte</option>
                          <option value="CHEATING_SUSPECT">
                            Suspicion de cheat
                          </option>
                          <option value="TEAM_REFUSAL">Refus d’équipe</option>
                          <option value="SPAM">Spam</option>
                          <option value="OTHER">Autre</option>
                        </select>

                        <input
                          name="message"
                          type="text"
                          required
                          placeholder="Raison de l’avertissement"
                          className="w-full px-4 py-3"
                        />

                        <button
                          type="submit"
                          className="neon-button w-full px-5 py-3"
                        >
                          Avertir
                        </button>
                      </form>
                    </div>
                  </div>

                  {player.status === "BANNED" ? (
                    <div className="mt-4 rounded-2xl border border-rose-400/15 bg-rose-400/[0.04] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300/80">
                        Déban du joueur
                      </p>

                      <form
                        action={liftBan}
                        className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"
                      >
                        <input type="hidden" name="userId" value={player.id} />

                        <input
                          name="reason"
                          type="text"
                          placeholder="Motif du déban (optionnel)"
                          className="w-full px-4 py-3"
                        />

                        <button type="submit" className="neon-button px-5 py-3">
                          Déban
                        </button>
                      </form>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">
                        Historique des avertissements
                      </p>
                      <span className="neon-badge">{player.totalWarnings} total</span>
                    </div>

                    {player.warnings.length === 0 ? (
                      <p className="mt-4 text-sm text-white/60">
                        Aucun avertissement pour ce joueur.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {player.warnings.map((warning) => (
                          <div
                            key={warning.id}
                            className="rounded-2xl border border-white/8 bg-black/20 p-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="neon-badge">
                                {getWarningTypeLabel(warning.type)}
                              </span>

                              <span
                                className={
                                  warning.status === "ACTIVE"
                                    ? "rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-300"
                                    : "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300"
                                }
                              >
                                {warning.status}
                              </span>

                              <span className="text-xs text-white/50">
                                {formatDate(warning.createdAt)}
                              </span>
                            </div>

                            <p className="mt-3 text-sm text-white">
                              {warning.message}
                            </p>

                            {warning.status === "REVOKED" ? (
                              <div className="mt-3 text-xs text-emerald-300/80">
                                <p>Révoqué le : {formatDate(warning.revokedAt)}</p>
                                {warning.revokedReason ? (
                                  <p className="mt-1">
                                    Motif : {warning.revokedReason}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {warning.status === "ACTIVE" ? (
                              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/80">
                                  Révoquer cet avertissement
                                </p>

                                <form
                                  action={revokeWarning}
                                  className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]"
                                >
                                  <input
                                    type="hidden"
                                    name="warningId"
                                    value={warning.id}
                                  />

                                  <input
                                    name="reason"
                                    type="text"
                                    placeholder="Motif de révocation (optionnel)"
                                    className="w-full px-4 py-3"
                                  />

                                  <button
                                    type="submit"
                                    className="neon-button-secondary px-5 py-3"
                                  >
                                    Révoquer
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}