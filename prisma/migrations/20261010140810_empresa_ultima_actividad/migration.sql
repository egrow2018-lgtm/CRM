-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "lastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Company_createdAt_idx" ON "Company"("createdAt");

-- CreateIndex
CREATE INDEX "Company_lastActivityAt_idx" ON "Company"("lastActivityAt");

-- Valor inicial: la actividad más reciente de la empresa, sus contactos o sus negocios
UPDATE "Company" c SET "lastActivityAt" = x.last
FROM (
  SELECT "companyId", MAX(t) AS last FROM (
    SELECT "companyId", "lastActivityAt" AS t FROM "Contact" WHERE "companyId" IS NOT NULL
    UNION ALL SELECT "companyId", "lastActivityAt" FROM "Deal" WHERE "companyId" IS NOT NULL
    UNION ALL SELECT "companyId", "createdAt" FROM "Activity" WHERE "companyId" IS NOT NULL
  ) u WHERE t IS NOT NULL GROUP BY "companyId"
) x
WHERE c.id = x."companyId";
