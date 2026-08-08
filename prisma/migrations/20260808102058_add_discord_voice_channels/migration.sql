-- CreateTable
CREATE TABLE "DiscordVoiceChannel" (
    "id" TEXT NOT NULL,
    "game" "MixGame" NOT NULL,
    "label" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordVoiceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordVoiceChannel_game_createdAt_idx" ON "DiscordVoiceChannel"("game", "createdAt");
