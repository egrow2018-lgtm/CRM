-- Cotizaciones directas a un contacto (sin negocio), p. ej. personas naturales de Rutalink
ALTER TABLE "Quote" ALTER COLUMN "dealId" DROP NOT NULL;
ALTER TABLE "Quote" ADD COLUMN "contactId" TEXT;
ALTER TABLE "Quote" ADD COLUMN "businessLineId" TEXT;
ALTER TABLE "BusinessLine" ADD COLUMN "quoteWithoutDeal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Quote_contactId_idx" ON "Quote"("contactId");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las cotizaciones existentes toman el contacto y la línea de su negocio
UPDATE "Quote" q SET "contactId" = d."contactId", "businessLineId" = d."businessLineId" FROM "Deal" d WHERE d."id" = q."dealId";

-- Rutalink cotiza a personas naturales sin negocio desde el inicio
UPDATE "BusinessLine" SET "quoteWithoutDeal" = true WHERE lower(name) LIKE '%rutalink%' OR lower(coalesce("brandName", '')) LIKE '%rutalink%';
