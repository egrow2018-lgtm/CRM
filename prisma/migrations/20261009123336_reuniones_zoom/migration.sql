-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "hostUrl" TEXT,
ADD COLUMN     "meetingPassword" TEXT,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "startAt" TIMESTAMP(3),
ADD COLUMN     "zoomMeetingId" TEXT;

-- CreateIndex
CREATE INDEX "Activity_startAt_idx" ON "Activity"("startAt");
