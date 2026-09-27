export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Settings,
  Trophy,
  Swords,
  Users,
  ListChecks,
  Shuffle,
  Lock,
  Vote,
  Gem,
} from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/server/auth/session";

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
  { href: "#modes", label: "1. Modes de jeu", icon: Settings },
  { href: "#creation", label: "2. Créer un tournoi", icon: Trophy },
  { href: "#classique", label: "3. Gérer un Classique", icon: ListChecks },
  { href: "#organigramme", label: "4. Gérer un Organigramme", icon: Swords },
  { href: "#sondage", label: "Sondage & tirage au sort", icon: Vote },
  { href: "#joueurs", label: "Côté joueurs", icon: Gem },
];

export default async function TournamentGuidePage() {
  const admin = await requireAdmin("points");
  if (!admin) redirect("/dashboard");

  return (
    <SiteShell>
      <div className="grid gap-5 md:gap-6">
        <div className="neon-card p-6 md:p-10">
          <span className="neon-badge">Guide admin</span>
          <h1 className="neon-title neon-gradient-text mt-4 text-2xl font-black md:text-4xl">
            Créer et gérer un tournoi
          </h1>
          <p className="neon-text-muted mt-4 max-w-2xl text-sm leading-7 md:text-base">
            Le système de points fonctionne en deux étapes : d’abord configurer
            les <span className="text-white">modes de jeu</span> (les règles,
            une seule fois), puis créer et faire vivre des{" "}
            <span className="text-white">tournois</span> (aussi souvent que
            tu veux — même pour une seule partie ponctuelle).
          </p>

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

        {/* ÉTAPE 1 — MODES DE JEU */}
        <div id="modes" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Settings className="h-5 w-5 text-cyan-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              1. Configurer les modes de jeu (
              <Link href="/admin/points" className="underline hover:text-white">
                /admin/points
              </Link>
              )
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Cette page ne sert qu’à ça : créer les modes de jeu (Warzone,
            BO7...) et leurs conditions de points. Elle ne gère ni parties ni
            scores — pour ça, direction les tournois plus bas.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Step n={1} title="Créer un mode de jeu">
              Un nom (ex : « Warzone Battle Royale ») et une description
              optionnelle. Il peut être désactivé plus tard sans le supprimer.
            </Step>
            <Step n={2} title="Ajouter des conditions">
              Chaque condition rapporte des points. Trois types : les points
              suivants t’aident à choisir.
            </Step>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="neon-card-soft p-4">
              <p className="text-sm font-semibold text-white">Ponctuelle</p>
              <p className="neon-text-muted mt-1.5 text-xs leading-5">
                Une case à cocher : atteinte ou pas (ex : « Victoire » = 15 pts
                si cochée, 0 sinon).
              </p>
            </div>
            <div className="neon-card-soft p-4">
              <p className="text-sm font-semibold text-white">Quantité</p>
              <p className="neon-text-muted mt-1.5 text-xs leading-5">
                Un nombre saisi, multiplié par les points de la condition (ex :
                « Kill » = 1 pt × nombre de kills). Peut être négatif (ex :
                « Mort » = -1 pt).
              </p>
            </div>
            <div className="neon-card-soft p-4">
              <p className="text-sm font-semibold text-white">Paliers</p>
              <p className="neon-text-muted mt-1.5 text-xs leading-5">
                Un nombre saisi, mais les points dépendent de la tranche (ex :
                « 5 à 9 kills » = 10 pts, « 10 et + » = 25 pts). Ajoute les
                paliers un par un sous la condition.
              </p>
            </div>
          </div>

          <p className="neon-text-muted mt-4 text-sm leading-7">
            Chaque condition cible aussi soit{" "}
            <span className="text-white">l’équipe entière</span> (ex :
            Victoire) soit <span className="text-white">un joueur précis</span>{" "}
            (ex : Kill, MVP) — à choisir à la création.
          </p>
        </div>

        {/* ÉTAPE 2 — CRÉER UN TOURNOI */}
        <div id="creation" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10">
              <Trophy className="h-5 w-5 text-amber-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              2. Créer un tournoi (
              <Link href="/admin/tournaments" className="underline hover:text-white">
                /admin/tournaments
              </Link>
              )
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            C’est ici que tout se passe pour lancer une session de jeu — même
            une seule partie ponctuelle. Tout se règle en un seul formulaire :
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Step n={1} title="Nom, description, date prévue">
              La date est affichée aux joueurs sur /points, utile pour le
              sondage de participation (voir plus bas).
            </Step>
            <Step n={2} title="Choisir le format">
              <span className="text-white">Classique</span> : cumul de points
              sur une ou plusieurs parties (un mode de jeu chacune).{" "}
              <span className="text-white">Organigramme</span> : élimination
              directe, équipe 1 vs équipe 2, etc.
            </Step>
            <Step n={3} title="Modes de jeu (Classique uniquement)">
              Coche les modes qui composent le tournoi — une partie sera créée
              pour chacun. Ignoré en Organigramme (pas de tableau de points).
            </Step>
            <Step n={4} title="Composition des équipes">
              <span className="text-white">Manuel</span> : tu ajoutes tout à la
              main. <span className="text-white">Libre choix</span> : les
              joueurs choisissent leur équipe sur /points.{" "}
              <span className="text-white">Aléatoire</span> : tu tires au sort
              (voir plus bas). Le nombre d’équipes est requis pour un
              Organigramme, ou pour un Classique en Libre choix/Aléatoire.
            </Step>
          </div>
        </div>

        {/* ÉTAPE 3A — CLASSIQUE */}
        <div id="classique" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
              <ListChecks className="h-5 w-5 text-emerald-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              3. Gérer un tournoi Classique
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Sur la page du tournoi, chaque mode de jeu sélectionné a sa propre
            carte « partie ». Elles se débloquent dans l’ordre :
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Step n={1} title="Créer la 1ère partie">
              Toujours disponible immédiatement. Les suivantes affichent
              « 🔒 Termine d’abord [partie précédente] » tant que ce n’est pas
              fait.
            </Step>
            <Step n={2} title="Ajouter équipes & joueurs">
              « Ajouter une équipe » puis, sur chaque équipe, un joueur inscrit
              (menu déroulant) ou un invité (nom libre). La composition se
              recopie automatiquement sur les autres parties du tournoi.
            </Step>
            <Step n={3} title="Saisir les scores">
              Coche/remplis les conditions pour l’équipe et pour chaque
              joueur, puis « Enregistrer les scores ». Refaisable autant de
              fois que nécessaire tant que la partie n’est pas terminée.
            </Step>
            <Step n={4} title="Terminer la partie">
              Verrouille les scores (lecture seule) et débloque la partie
              suivante. Un bouton « Modifier les scores » permet de rouvrir à
              tout moment pour corriger.
            </Step>
          </div>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/2 p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-cyan-300" />
              <p className="text-sm font-semibold text-white">
                Résultat final
              </p>
            </div>
            <p className="neon-text-muted mt-2 text-sm leading-6">
              Une fois toutes les parties saisies, la page joueur du tournoi (
              <span className="text-white">/points/[id]</span>) affiche un
              tableau : chaque équipe, ses points sur chaque partie, et son
              total — pour voir exactement qui a fait quoi.
            </p>
          </div>
        </div>

        {/* ÉTAPE 3B — ORGANIGRAMME */}
        <div id="organigramme" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10">
              <Swords className="h-5 w-5 text-fuchsia-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              4. Gérer un tournoi Organigramme (bracket)
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Double élimination : une défaite descend l’équipe dans le bracket
            Perdants pour une seconde chance ; une 2e défaite élimine
            définitivement.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Step n={1} title="Déclarer les équipes">
              Créées automatiquement (« Équipe 1 »..« Équipe N ») dès la
              création du tournoi. Ajoute les joueurs de chacune directement
              sur la page — ou ajoute d’autres équipes par nom si besoin.
            </Step>
            <Step n={2} title="Démarrer le tournoi">
              Tire au sort et génère le 1er tour (avec un « bye » — qualifié
              d’office — si le nombre d’équipes n’est pas une puissance de 2).
              Verrouille aussi la liste des équipes.
            </Step>
            <Step n={3} title="Déclarer les vainqueurs">
              Un bouton « Gagne » à côté de chaque équipe d’un match. Une fois
              tout le tour décidé, « Générer le tour suivant » apparaît.
            </Step>
            <Step n={4} title="Grande finale & champion">
              Une fois chaque bracket réduit à un champion, la grande finale
              (Gagnants vs Perdants) désigne le champion du tournoi.
            </Step>
          </div>
        </div>

        {/* SONDAGE & TIRAGE AU SORT */}
        <div id="sondage" className="neon-card scroll-mt-24 p-5 md:p-8">
          <span className="neon-badge">Astuce</span>
          <h2 className="mt-3 flex items-center gap-2 text-lg font-bold text-white md:text-xl">
            <Vote className="h-4 w-4 text-cyan-300" /> Sondage de participation
            &amp; tirage au sort
          </h2>
          <p className="neon-text-muted mt-3 text-sm leading-7">
            Avant même de former les équipes, les joueurs peuvent indiquer
            « Je participe » sur la page du tournoi (/points/[id]) — comme la
            queue des mix Warzone/BO7.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-300" />
                <p className="text-sm font-semibold text-white">Qui vote ?</p>
              </div>
              <p className="neon-text-muted mt-2 text-sm leading-6">
                N’importe quel joueur connecté, tant que le tournoi n’a pas
                démarré. La liste des intéressés est visible sur la page.
              </p>
            </div>
            <div className="neon-card-soft p-4">
              <div className="flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-amber-300" />
                <p className="text-sm font-semibold text-white">
                  Tirage au sort (mode Aléatoire)
                </p>
              </div>
              <p className="neon-text-muted mt-2 text-sm leading-6">
                Sur la page du tournoi, les joueurs intéressés apparaissent en
                tête de liste et sont déjà cochés — tu n’as qu’à ajuster si
                besoin puis cliquer sur « Générer les équipes ». Si tu
                sélectionnes plus de joueurs que la capacité configurée
                (équipes × joueurs max), le nombre d’équipes est ajusté
                automatiquement pour que tout le monde ait une place.
              </p>
            </div>
          </div>
        </div>

        {/* CÔTÉ JOUEURS */}
        <div id="joueurs" className="neon-card scroll-mt-24 p-5 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Gem className="h-5 w-5 text-cyan-300" />
            </span>
            <h2 className="text-lg font-bold text-white md:text-xl">
              Ce que voient les joueurs (
              <Link href="/points" className="underline hover:text-white">
                /points
              </Link>
              )
            </h2>
          </div>
          <p className="neon-text-muted mt-4 text-sm leading-7">
            Une liste de cartes (nom, format, date prévue, statut) — cliquer
            dessus ouvre la page détail du tournoi : composition des équipes,
            classement par mode de jeu ou bracket complet selon le format, et
            le sondage de participation.
          </p>
        </div>

        {/* RETOUR */}
        <div className="neon-card p-5 text-center md:p-6">
          <Link
            href="/admin/tournaments"
            className="neon-button-secondary mt-1 inline-flex px-4 py-2.5 md:px-6 md:py-3"
          >
            Retour à Admin Tournois
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
