-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NUEVO', 'EN_SEGUIMIENTO', 'CALIFICADO', 'DESCARTADO');

-- AlterTable
ALTER TABLE "BusinessLine" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "leadStatus" "LeadStatus";

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "customData" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "submitLabel" TEXT NOT NULL DEFAULT 'Enviar',
    "successMessage" TEXT NOT NULL DEFAULT '¡Gracias! Te contactaremos pronto.',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "businessLineId" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_leadStatus_idx" ON "Contact"("leadStatus");

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
