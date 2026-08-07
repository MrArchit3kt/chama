-- Drop unused site-wide access password field (never enforced anywhere)
ALTER TABLE "SiteConfig" DROP COLUMN "siteAccessPassword";
