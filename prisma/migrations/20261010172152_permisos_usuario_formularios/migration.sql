-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "consentEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "consentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "customPermissions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "FormView" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormView_formId_createdAt_idx" ON "FormView"("formId", "createdAt");

-- AddForeignKey
ALTER TABLE "FormView" ADD CONSTRAINT "FormView_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
