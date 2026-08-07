-- Align DB column defaults with schema.prisma (CHAMA rebrand)
ALTER TABLE "SiteConfig" ALTER COLUMN "siteName" SET DEFAULT 'CHAMA Squad Manager';
ALTER TABLE "SiteConfig" ALTER COLUMN "homeHeadline" SET DEFAULT 'CHAMA Warzone Squad';
