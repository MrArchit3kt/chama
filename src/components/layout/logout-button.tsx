"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

type LogoutButtonProps = {
  className?: string;
};

const DEFAULT_CLASS =
  "relative inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white transition hover:border-cyan-400/20 hover:bg-white/[0.05]";

export function LogoutButton({ className }: LogoutButtonProps) {
  const handleLogout = async () => {
    // ⚠️ signOut() invalide la session avant sa redirection : si on la
    // laissait déclencher /api/presence/leave via l'événement beforeunload
    // habituel, la requête arriverait sans session valide et ne ferait
    // rien (401). On appelle donc "leave" nous-mêmes en premier, pendant
    // qu'on est encore authentifié — ça marque hors-ligne ET libère un
    // éventuel verrou de génération mix dont ce compte serait titulaire.
    try {
      await fetch("/api/presence/leave", { method: "POST", keepalive: true });
    } catch {
      // on se déconnecte quand même même si cet appel échoue
    }

    signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={className ?? DEFAULT_CLASS}
    >
      <LogOut className="h-4 w-4 text-white/80" />
      <span>Déconnexion</span>
    </button>
  );
}