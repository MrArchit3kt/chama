-- Appartenance à la team partenaire AURA (tag admin, comme isChamaMember)
ALTER TABLE "User" ADD COLUMN "isAuraMember" BOOLEAN NOT NULL DEFAULT false;
