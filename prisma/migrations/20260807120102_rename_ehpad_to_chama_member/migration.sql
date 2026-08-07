-- Rename column to match the CHAMA rebrand (no data loss, pure rename)
ALTER TABLE "User" RENAME COLUMN "isEhpadMember" TO "isChamaMember";
