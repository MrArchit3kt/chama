-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "bo7MixEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rocketLeagueMixEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "versusMixEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warzoneMixEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "warzoneRankedMixEnabled" BOOLEAN NOT NULL DEFAULT true;
