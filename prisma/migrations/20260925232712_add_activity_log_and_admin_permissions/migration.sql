-- Permissions fines déléguées par un SUPER_ADMIN à un ADMIN
ALTER TABLE "User" ADD COLUMN "adminPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('REGISTRATION_CREATED', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED', 'ROLE_CHANGED', 'ADMIN_PERMISSIONS_UPDATED', 'CHAMA_TOGGLED', 'AURA_TOGGLED', 'PLAYER_BANNED', 'PLAYER_UNBANNED', 'PLAYER_DELETED', 'PASSWORD_RESET', 'WARNING_ADDED', 'WARNING_REVOKED', 'BADGE_CREATED', 'BADGE_DELETED', 'BADGE_AWARDED', 'BADGE_REVOKED', 'DISCORD_CHANNEL_CREATED', 'DISCORD_CHANNEL_UPDATED', 'DISCORD_CHANNEL_DELETED', 'EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED', 'EVENT_ROSTER_UPDATED', 'CONTACT_CLOSED', 'SITE_CONFIG_UPDATED', 'MIX_GENERATED');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_action_createdAt_idx" ON "ActivityLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");

-- CreateIndex
CREATE INDEX "ActivityLog_targetId_idx" ON "ActivityLog"("targetId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
