import { describe, expect, it } from "vitest";
import {
  buildRocketLeagueTeams,
  getTeamSizesFourThree,
  getTeamSizesVersus,
  getTeamSizesWarzoneRanked,
  rankIndex,
  shuffle,
  teamSizeFromLock,
} from "./mix-logic";

describe("getTeamSizesFourThree (Warzone / BO7)", () => {
  it("refuse un pool trop petit", () => {
    expect(getTeamSizesFourThree(0)).toBeNull();
    expect(getTeamSizesFourThree(1)).toBeNull();
    expect(getTeamSizesFourThree(2)).toBeNull();
  });

  it("refuse explicitement 5 joueurs (ni 4+1, ni 3+2 valides)", () => {
    expect(getTeamSizesFourThree(5)).toBeNull();
  });

  it("renvoie les tailles attendues pour des cas connus", () => {
    expect(getTeamSizesFourThree(3)).toEqual([3]);
    expect(getTeamSizesFourThree(4)).toEqual([4]);
    expect(getTeamSizesFourThree(6)).toEqual([3, 3]);
    expect(getTeamSizesFourThree(7)).toEqual([4, 3]);
    expect(getTeamSizesFourThree(8)).toEqual([4, 4]);
  });

  it("ne laisse jamais personne de côté : la somme des tailles == le total", () => {
    for (let total = 3; total <= 60; total += 1) {
      if (total === 5) continue;
      const sizes = getTeamSizesFourThree(total);
      expect(sizes).not.toBeNull();
      expect(sizes!.reduce((a, b) => a + b, 0)).toBe(total);
      for (const size of sizes!) {
        expect([3, 4]).toContain(size);
      }
    }
  });
});

describe("getTeamSizesWarzoneRanked (strict 3v3)", () => {
  it("refuse un pool non divisible par 3", () => {
    expect(getTeamSizesWarzoneRanked(1)).toBeNull();
    expect(getTeamSizesWarzoneRanked(2)).toBeNull();
    expect(getTeamSizesWarzoneRanked(4)).toBeNull();
    expect(getTeamSizesWarzoneRanked(10)).toBeNull();
  });

  it("accepte uniquement des multiples de 3", () => {
    expect(getTeamSizesWarzoneRanked(3)).toEqual([3]);
    expect(getTeamSizesWarzoneRanked(9)).toEqual([3, 3, 3]);
    expect(getTeamSizesWarzoneRanked(0)).toBeNull(); // total < 3
  });
});

describe("getTeamSizesVersus (strict 4v4)", () => {
  it("refuse un pool non divisible par 4", () => {
    expect(getTeamSizesVersus(1)).toBeNull();
    expect(getTeamSizesVersus(2)).toBeNull();
    expect(getTeamSizesVersus(3)).toBeNull();
    expect(getTeamSizesVersus(6)).toBeNull();
    expect(getTeamSizesVersus(10)).toBeNull();
  });

  it("accepte uniquement des multiples de 4", () => {
    expect(getTeamSizesVersus(4)).toEqual([4]);
    expect(getTeamSizesVersus(8)).toEqual([4, 4]);
    expect(getTeamSizesVersus(12)).toEqual([4, 4, 4]);
    expect(getTeamSizesVersus(0)).toBeNull(); // total < 4
  });
});

describe("shuffle", () => {
  it("conserve exactement les mêmes éléments (juste réordonnés)", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = shuffle(original);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort()).toEqual([...original].sort());
  });

  it("ne mute pas le tableau d'origine", () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });
});

describe("rankIndex (Rocket League)", () => {
  it("classe les rangs connus dans l'ordre croissant", () => {
    expect(rankIndex("BRONZE")).toBe(0);
    expect(rankIndex("GOLD")).toBeGreaterThan(rankIndex("SILVER"));
    expect(rankIndex("SSL")).toBeGreaterThan(rankIndex("GRAND_CHAMPION"));
  });

  it("renvoie -1 pour un rang inconnu", () => {
    expect(rankIndex("NOT_A_RANK")).toBe(-1);
  });
});

describe("buildRocketLeagueTeams", () => {
  it("forme des équipes de même rang sans mélange nécessaire", () => {
    const players = [
      { key: "a", rocketLeagueRank: "GOLD" },
      { key: "b", rocketLeagueRank: "GOLD" },
      { key: "c", rocketLeagueRank: "PLATINUM" },
      { key: "d", rocketLeagueRank: "PLATINUM" },
    ];

    const teams = buildRocketLeagueTeams(players, 2);
    expect(teams).not.toBeNull();
    expect(teams).toHaveLength(2);
    for (const team of teams!) {
      expect(team).toHaveLength(2);
      const indices = team.map((p) => rankIndex(p.rocketLeagueRank));
      expect(Math.max(...indices) - Math.min(...indices)).toBeLessThanOrEqual(1);
    }
  });

  it("refuse un pool non divisible par la taille d'équipe", () => {
    const players = [
      { key: "a", rocketLeagueRank: "GOLD" },
      { key: "b", rocketLeagueRank: "GOLD" },
      { key: "c", rocketLeagueRank: "GOLD" },
    ];
    expect(buildRocketLeagueTeams(players, 2)).toBeNull();
  });

  it("refuse si un rang est manquant/invalide", () => {
    const players = [
      { key: "a", rocketLeagueRank: "GOLD" },
      { key: "b", rocketLeagueRank: "" },
    ];
    expect(buildRocketLeagueTeams(players, 2)).toBeNull();
  });

  it("refuse quand l'écart de rang est impossible à respecter", () => {
    // 3 GOLD + 1 BRONZE en équipes de 2 : quelle que soit la répartition,
    // le BRONZE se retrouve forcément avec un GOLD (écart de 2 paliers).
    const players = [
      { key: "a", rocketLeagueRank: "GOLD" },
      { key: "b", rocketLeagueRank: "GOLD" },
      { key: "c", rocketLeagueRank: "GOLD" },
      { key: "d", rocketLeagueRank: "BRONZE" },
    ];
    expect(buildRocketLeagueTeams(players, 2)).toBeNull();
  });
});

describe("teamSizeFromLock", () => {
  it("convertit l'enum Prisma en taille numérique", () => {
    expect(teamSizeFromLock("TWO")).toBe(2);
    expect(teamSizeFromLock("THREE")).toBe(3);
  });

  it("renvoie null si aucun format n'est verrouillé", () => {
    expect(teamSizeFromLock(null)).toBeNull();
    expect(teamSizeFromLock(undefined)).toBeNull();
  });
});
