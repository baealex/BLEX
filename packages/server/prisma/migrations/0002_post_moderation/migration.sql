-- AlterTable
ALTER TABLE "Post" ADD COLUMN "moderatedAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "moderation" TEXT;

-- CreateIndex
CREATE INDEX "Post_moderation_idx" ON "Post"("moderation");

