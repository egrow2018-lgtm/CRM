-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('EMITIDA', 'EN_REVISION', 'APROBADA', 'NO_APROBADA');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "requestKey" TEXT,
ADD COLUMN     "status" "QuoteStatus" NOT NULL DEFAULT 'EMITIDA',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_requestKey_key" ON "Quote"("requestKey");


-- Las cotizaciones ya enviadas quedan "En revisión"
UPDATE "Quote" SET "status" = 'EN_REVISION' WHERE "sentAt" IS NOT NULL;
