export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Home,
  UserCircle2,
  Crosshair,
  Trophy,
  Swords,
  Rocket,
  Share2,
  AlertTriangle,
  UserPlus,
  LogOut,
  KeyRound,
  Mail,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAuth } from "@/server/auth/session";

type StepProps = {
  n: number;
  title: string;
  children: React.ReactNode;
};

function Step({ n, title, children }: StepProps) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/10 text-xs font-bold text-cyan-300">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="neon-text-muted mt-1 text-sm leading-6">{children}</p>
      </div>
    </div>
  );
}

const toc = [
  { href: "#profil", label: "Profil", icon: UserCircle2 },
  { href: "#mix", label: "Files & équipes", icon: Crosshair },
  { href: "#warzone", label: "Warzone", icon: Crosshair },
  { href: "#ranked", label: "Ranked", icon: Trophy },
  { href: "#bo7", label: "BO7", icon: Swords },
  { href: "#rocket-league", label: "Rocket League", icon: Rocket },
  { href: "#assistance", label: "Réseaux & Assistance", icon: Share2 },
];

export default async function TutoPage() {
  const user = await requireAuth();
  if (!user) redirect("/login");

  return (
    <SiteShell>
      <div className="grid gap-5 md:gap-6">
        {/* HEADER */}
        <div className="neon-card p-6 md:p-10">
          <span className="neon-badge">Guide</span>
          <h1 className="neon-title neon-gradient-text mt-4 text-2xl font-black md:text-4xl">
            Comment utiliser le site
          </h1>
          <p className="neon-text-muted mt-4 max-w-2xl text-sm leading-7 md:text-base">
            Un tour rapide de chaque page pour t’y retrouver : ton profil, les
            files de mix par jeu, et comment contacter les admins. Deux minutes
            de lecture, promis.
          </p>

          {/* Sommaire */}
          <div className="mt-6 flex flex-wrap gap-2">
            {toc.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="neon-button-secondary inline-flex items-center gap-2 px-3.5 py-2 text-xs md:text-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* ACCUEIL */}
        <div className="neon-card p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
              <Home className="h-5 w-5 text-cyan-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">Accueil</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            La page d’accueil résume la vie de la team : image de présentation,
            derniers événements annoncés, et boutons rapides pour accéder à ton
            profil, aux réseaux ou pour contacter les admins. C’est le point de
            départ à chaque connexion.
          </p>
        </div>

        {/* PROFIL */}
        <div id="profil" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <UserCircle2 className="h-5 w-5 text-cyan-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">Profil</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            C’est ton espace personnel : toutes tes infos joueur, ton email et
            ton mot de passe. Rien à voir avec les files de mix — pour ça, direction
            les onglets par jeu plus bas.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-semibold text-white">Mes informations</p>
              </div>
              <p className="neon-text-muted mt-2 text-sm leading-6">
                Nom affiché, email, pseudo Warzone, Activision ID, plateforme,
                rôle préféré, rang Rocket League, Discord, WhatsApp. Modifie ce
                que tu veux puis clique sur « Enregistrer les modifications ».
              </p>
            </div>

            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-pink-300" />
                <p className="text-sm font-semibold text-white">Mot de passe</p>
              </div>
              <p className="neon-text-muted mt-2 text-sm leading-6">
                Saisis ton mot de passe actuel, puis le nouveau deux fois
                (minimum 6 caractères). Il faut connaître l’ancien pour pouvoir
                le changer.
              </p>
            </div>
          </div>
        </div>

        {/* MIX / FILES - explication générale */}
        <div id="mix" className="neon-card scroll-mt-24 p-5 md:p-8">
          <span className="neon-badge">Le plus important</span>
          <h2 className="mt-3 text-lg font-bold text-white md:text-xl">
            Comment marchent les files de mix ?
          </h2>
          <p className="neon-text-muted mt-3 text-sm leading-7">
            Chaque jeu (Warzone, Ranked, BO7, Rocket League) a son propre onglet
            dans le menu, mais ils fonctionnent tous exactement pareil :
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Step n={1} title="Rejoins la file">
              Clique sur « Rejoindre la file » dans l’onglet du jeu qui
              t’intéresse. Tu ne peux être que dans une seule file à la fois :
              en rejoindre une nouvelle te retire automatiquement des autres.
            </Step>
            <Step n={2} title="Génère (si permis)">
              Le bouton « Générer les équipes » ne fonctionne que si aucun
              admin n’est en ligne, ou si un admin t’a désigné comme
              générateur. Sinon, patiente : un admin s’en charge.
            </Step>
            <Step n={3} title="Regarde ton équipe">
              Une fois les équipes générées, elles s’affichent toutes sur la
              page — la tienne apparaît en premier avec un badge « TON ÉQUIPE ».
            </Step>
          </div>
        </div>

        {/* WARZONE */}
        <div id="warzone" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-pink-400/20 bg-pink-400/10">
              <Crosshair className="h-5 w-5 text-pink-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">Warzone</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Format classique : le site répartit tous les joueurs de la file en
            équipes de 4, avec des équipes de 3 pour les restes. Personne n’est
            laissé de côté.
          </p>
        </div>

        {/* RANKED */}
        <div id="ranked" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
              <Trophy className="h-5 w-5 text-amber-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">Ranked</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Strict : uniquement des équipes de 3. Le nombre de joueurs dans la
            file doit être divisible par 3, sinon la génération refusera (ex :
            3, 6, 9, 12 joueurs).
          </p>
        </div>

        {/* BO7 */}
        <div id="bo7" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10">
              <Swords className="h-5 w-5 text-fuchsia-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">BO7</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Même principe que Warzone : équipes de 4, complétées par des
            équipes de 3 si besoin. Une file complètement séparée des autres
            jeux.
          </p>
        </div>

        {/* ROCKET LEAGUE */}
        <div id="rocket-league" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
              <Rocket className="h-5 w-5 text-emerald-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">Rocket League</h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Un peu différent : le format (2v2 ou 3v3) est choisi par un admin,
            et ton <span className="text-white">rang Rocket League</span> doit
            être renseigné dans ton profil pour pouvoir être placé dans une
            équipe équilibrée. Sans rang, impossible de générer.
          </p>
        </div>

        {/* RESEAUX & ASSISTANCE */}
        <div id="assistance" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10">
              <Share2 className="h-5 w-5 text-indigo-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              Réseaux & Assistance
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            La page « Réseaux » (accessible depuis l’accueil) regroupe le lien
            Discord de la team et un espace pour contacter les admins,
            classé en 3 catégories :
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="neon-card-soft p-4">
              <SiDiscord className="h-5 w-5 text-indigo-300" />
              <p className="mt-2 text-sm font-semibold text-white">Discord</p>
              <p className="neon-text-muted mt-1 text-xs leading-5">
                Rejoins le serveur vocal de la team.
              </p>
            </div>

            <div className="neon-card-soft p-4">
              <AlertTriangle className="h-5 w-5 text-rose-300" />
              <p className="mt-2 text-sm font-semibold text-white">
                Signaler un problème
              </p>
              <p className="neon-text-muted mt-1 text-xs leading-5">
                Joueur toxique, bug, souci Discord…
              </p>
            </div>

            <div className="neon-card-soft p-4">
              <UserPlus className="h-5 w-5 text-emerald-300" />
              <p className="mt-2 text-sm font-semibold text-white">
                Demande de recrutement
              </p>
              <p className="neon-text-muted mt-1 text-xs leading-5">
                Un ami veut rejoindre CHAMA.
              </p>
            </div>

            <div className="neon-card-soft p-4">
              <LogOut className="h-5 w-5 text-amber-300" />
              <p className="mt-2 text-sm font-semibold text-white">
                Quitter la team
              </p>
              <p className="neon-text-muted mt-1 text-xs leading-5">
                Préviens les admins proprement.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Link href="/socials" className="neon-button inline-flex px-4 py-2.5 md:px-6 md:py-3">
              Aller sur la page Réseaux
            </Link>
          </div>
        </div>

        {/* RETOUR */}
        <div className="neon-card p-5 text-center md:p-6">
          <p className="neon-text-muted text-sm">
            Une question qui n’est pas couverte ici ?
          </p>
          <Link
            href="/contact"
            className="neon-button-secondary mt-3 inline-flex px-4 py-2.5 md:px-6 md:py-3"
          >
            Contacter les admins
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
