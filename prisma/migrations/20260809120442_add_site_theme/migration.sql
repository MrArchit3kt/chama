-- CreateEnum
CREATE TYPE "SiteTheme" AS ENUM ('DEFAULT', 'HALLOWEEN', 'CHRISTMAS');

-- AlterTable
ALTER TABLE "SiteConfig" ADD COLUMN     "theme" "SiteTheme" NOT NULL DEFAULT 'DEFAULT';
