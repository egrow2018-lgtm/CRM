import "server-only";
import { prisma } from "./db";

/** Datos de la empresa que aparecen en las cotizaciones. Se editan en Configuración. */
export type CompanySettings = {
  name: string;
  legalName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  ivaPercent: number;
  validityDays: number;
  conditions: string;
};

export const DEFAULT_COMPANY: CompanySettings = {
  name: "e-grow",
  legalName: "",
  taxId: "",
  address: "Quito, Ecuador",
  phone: "",
  email: "",
  website: "www.e-growonline.com",
  ivaPercent: 15,
  validityDays: 15,
  conditions: [
    "Forma de pago: 50% de anticipo a la firma del contrato y 50% contra entrega.",
    "Los valores están expresados en dólares de los Estados Unidos (USD).",
    "Los plazos de entrega se cuentan desde la recepción del anticipo y de los insumos del cliente.",
  ].join("\n"),
};

export async function getCompanySettings(): Promise<CompanySettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: "company" } });
  return { ...DEFAULT_COMPANY, ...((row?.value as Partial<CompanySettings>) ?? {}) };
}

export async function saveCompanySettings(value: CompanySettings) {
  await prisma.appSetting.upsert({ where: { key: "company" }, update: { value }, create: { key: "company", value } });
}
