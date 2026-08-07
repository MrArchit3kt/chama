-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twitchUsername" TEXT;

-- CreateIndex
CREATE INDEX "User_twitchUsername_idx" ON "User"("twitchUsername");
