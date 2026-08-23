-- Format Versus choisi par un admin (2v2/3v3/4v4), comme Rocket League
CREATE TYPE "VersusTeamSize" AS ENUM ('TWO', 'THREE', 'FOUR');

ALTER TABLE "MixGenerationLock" ADD COLUMN "versusTeamSize" "VersusTeamSize";
