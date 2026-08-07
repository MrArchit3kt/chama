"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function getLoginErrorMessage(error?: string | null) {
  switch (error) {
    case "ACCOUNT_PENDING_APPROVAL":
      return "Ton compte est en attente de validation par un admin.";
    case "ACCOUNT_REJECTED":
      return "Ton inscription a été refusée. Contacte un admin si besoin.";
    case "ACCOUNT_BANNED":
      return "Ton compte est banni et ne peut pas se connecter.";
    case "ACCOUNT_LOCKED":
      return "Trop de tentatives échouées. Réessaie dans 15 minutes.";
    case "CredentialsSignin":
      return "Identifiants invalides.";
    default:
      return "Identifiants invalides ou compte inaccessible.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const registered = searchParams.get("registered") === "1";
  const callbackUrl = searchParams.get("callbackUrl") || "/profil";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result) {
        setErrorMessage("Erreur de connexion. Réessaie.");
        return;
      }

      if (result.error) {
        setErrorMessage(getLoginErrorMessage(result.error));
        return;
      }

      router.push(result.url || "/profil");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          className="w-full px-4 py-3"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-white">
          Mot de passe
        </label>
        <input
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ton mot de passe"
          className="w-full px-4 py-3"
        />
      </div>

      {registered ? (
        <p className="text-sm font-medium text-emerald-400">
          Compte créé. Il doit maintenant être validé par un admin avant que tu puisses te connecter.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm font-medium text-rose-400">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="neon-button w-full px-4 py-3 disabled:opacity-70"
      >
        {isPending ? "Connexion..." : "Connexion"}
      </button>

      <p className="neon-text-muted mt-5 text-sm">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-semibold text-cyan-300">
          S’inscrire
        </Link>
      </p>
    </form>
  );
}