-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "guests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extraEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
