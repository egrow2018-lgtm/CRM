-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "renewalDate" TIMESTAMP(3),
ADD COLUMN     "renewalOfId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "renewalMonths" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "dealId" TEXT NOT NULL,
    "createdById" TEXT,
    "publicToken" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");

-- CreateIndex
CREATE INDEX "Quote_dealId_idx" ON "Quote"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_year_number_key" ON "Quote"("year", "number");

-- CreateIndex
CREATE INDEX "Deal_renewalDate_idx" ON "Deal"("renewalDate");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_renewalOfId_fkey" FOREIGN KEY ("renewalOfId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
