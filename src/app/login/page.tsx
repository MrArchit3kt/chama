export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    if (user.registrationStatus === "PENDING") {
      redirect("/approval-pending");
    }

    if (user.registrationStatus === "REJECTED") {
      redirect("/approval-rejected");
    }

    redirect("/profil");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="neon-card p-7 md:p-8">
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="neon-badge">Connexion</span>
              <span className="neon-badge">CHAMA</span>
            </div>

            <h1 className="neon-title neon-gradient-text text-3xl font-black">
              Se connecter
            </h1>

            <p className="neon-text-muted mt-3 text-sm leading-6">
              Accède à ton espace joueur.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}