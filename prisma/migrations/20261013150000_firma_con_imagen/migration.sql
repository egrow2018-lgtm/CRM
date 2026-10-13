-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signatureImageId" TEXT,
ADD COLUMN     "signatureImageWidth" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_signatureImageId_fkey" FOREIGN KEY ("signatureImageId") REFERENCES "EmailImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

