-- Tipo de cobro: pago único, mensual o anual
CREATE TYPE "Billing" AS ENUM ('UNICO', 'MENSUAL', 'ANUAL');

ALTER TABLE "Product" ADD COLUMN "billing" "Billing" NOT NULL DEFAULT 'UNICO';
ALTER TABLE "DealItem" ADD COLUMN "billing" "Billing" NOT NULL DEFAULT 'UNICO';
ALTER TABLE "DealItem" ADD COLUMN "termMonths" INTEGER;
ALTER TABLE "Deal" ADD COLUMN "recurringMonthly" DECIMAL(14,2);
ALTER TABLE "Deal" ADD COLUMN "recurringAnnual" DECIMAL(14,2);

-- Los productos que se renovaban cada mes pasan a «Mensual»; los de 12 meses o más, a «Anual».
-- renewalMonths queda como el plazo del contrato (mínimo 12 meses para los mensuales).
UPDATE "Product" SET "billing" = 'MENSUAL', "renewalMonths" = 12 WHERE "renewalMonths" IS NOT NULL AND "renewalMonths" < 12;
UPDATE "Product" SET "billing" = 'ANUAL' WHERE "renewalMonths" IS NOT NULL AND "renewalMonths" >= 12 AND "billing" = 'UNICO';
-- Los que dicen «mensual» en su nombre (ej. «Servicio de monitoreo mensual») son mensuales con contrato de 12 meses
UPDATE "Product" SET "billing" = 'MENSUAL' WHERE "billing" = 'ANUAL' AND (lower("name") LIKE '%mensual%' OR lower(coalesce("description", '')) LIKE '%mensual%');
-- Los negocios y montos existentes no cambian (sus productos quedan como pago único).
