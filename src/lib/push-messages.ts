/**
 * Textes des notifications push — un pool de 5 variantes par événement pour
 * ne pas afficher exactement le même message à chaque fois. Choix aléatoire
 * dans le pool à chaque envoi (voir `pickMessage`).
 */

function pickMessage(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

export function eventPublishedPush(eventTitle: string) {
  const bodies = [
    `Un nouvel événement vient d'être posté : ${eventTitle}. Viens jeter un œil 👀`,
    `📅 Ça bouge sur CHAMA ! Nouvel événement : ${eventTitle}.`,
    `Hop, un événement tout frais : ${eventTitle}. Ne le loupe pas !`,
    `Nouvel événement en approche : ${eventTitle}. Toutes les infos t'attendent.`,
    `🔥 ${eventTitle} vient d'être annoncé — direction l'appli pour les détails.`,
  ];
  return { title: "Nouvel événement CHAMA", body: pickMessage(bodies) };
}

export function tournamentPublishedPush(tournamentName: string) {
  const bodies = [
    `Un nouveau tournoi est lancé : ${tournamentName}. Inscris-toi vite !`,
    `🏆 Tournoi annoncé : ${tournamentName}. Qui sera champion ?`,
    `Ça se prépare : ${tournamentName} vient d'être créé. Rejoins la compét'.`,
    `Nouveau tournoi sur CHAMA : ${tournamentName}. Fonce voir les détails.`,
    `⚔️ ${tournamentName} est ouvert ! Va checker les équipes et le format.`,
  ];
  return { title: "Nouveau tournoi CHAMA", body: pickMessage(bodies) };
}

export function tournamentStartingSoonPush(tournamentName: string, minutesUntilStart: number) {
  const when =
    minutesUntilStart <= 1
      ? "maintenant"
      : minutesUntilStart < 60
        ? `dans ${minutesUntilStart} min`
        : `dans ${Math.round(minutesUntilStart / 60)}h`;

  const bodies = [
    `${tournamentName} commence ${when} — prépare-toi !`,
    `⏰ Ça va être chaud : ${tournamentName} démarre ${when}.`,
    `Dernière ligne droite avant ${tournamentName}, ça commence ${when}.`,
    `Top départ ${when} pour ${tournamentName}. Sois prêt à jouer !`,
    `${tournamentName} : coup d'envoi ${when}. On se retrouve dans l'appli.`,
  ];
  return { title: "Le tournoi commence bientôt", body: pickMessage(bodies) };
}
