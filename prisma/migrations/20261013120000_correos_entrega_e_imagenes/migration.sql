-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "deliveryCheckedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "providerId" TEXT;

-- CreateTable
CREATE TABLE "EmailImage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailImage" ADD CONSTRAINT "EmailImage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

