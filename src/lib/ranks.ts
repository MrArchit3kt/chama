export const ROCKET_LEAGUE_RANK_LABELS: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Argent",
  GOLD: "Or",
  PLATINUM: "Platine",
  DIAMOND: "Diamant",
  CHAMPION: "Champion",
  GRAND_CHAMPION: "Grand Champion",
  SSL: "SSL",
};

export const WARZONE_RANK_TIER_LABELS: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Argent",
  GOLD: "Or",
  PLATINUM: "Platine",
  DIAMOND: "Diamant",
  CRIMSON: "Cramoisi",
  IRIDESCENT: "Irisé",
  TOP_250: "Top 250",
};

export function rocketLeagueRankLabel(rank: string | null | undefined) {
  return rank ? (ROCKET_LEAGUE_RANK_LABELS[rank] ?? rank) : "Non renseigné";
}

export function warzoneRankTierLabel(tier: string | null | undefined) {
  return tier ? (WARZONE_RANK_TIER_LABELS[tier] ?? tier) : "Non renseigné";
}
