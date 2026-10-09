import { PrismaClient, ProductType, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ELEARNING_FIELDS } from "../src/lib/custom-fields";

const prisma = new PrismaClient();

/** Equipo de e-grow. Cada persona puede cambiar su contraseña en "Mi perfil". */
const TEAM: { name: string; email: string; role: Role }[] = [
  { name: "Andrés Poveda", email: "apoveda@e-growonline.com", role: "ADMIN" },
  { name: "María Isabel Piñeiros", email: "mipineiros@e-growonline.com", role: "COMERCIAL" },
  { name: "Janine Salgado", email: "mjsalgado@e-growonline.com", role: "PROYECTOS" },
];

const STAGES = [
  { name: "Contacto", probability: 10 },
  { name: "Presentación", probability: 30 },
  { name: "Cotización-Envío", probability: 40 },
  { name: "Revisión-Negociación", probability: 70 },
  { name: "Firma de Contrato", probability: 80 },
  { name: "En Producción", probability: 90 },
  { name: "Cerrado Ganado", probability: 100, isWon: true },
  { name: "Cerrado Perdido", probability: 0, isLost: true },
  { name: "StandBy", probability: 0 },
];

const LINES: { name: string; description: string; color: string; products: [string, ProductType][] }[] = [
  {
    name: "E-learning",
    description: "Plataformas LMS, cursos virtuales y producción audiovisual",
    color: "#087d93",
    products: [
      ["Plataforma LMS", ProductType.SERVICIO],
      ["Curso virtual", ProductType.SERVICIO],
      ["Producción audiovisual / Video learning", ProductType.SERVICIO],
    ],
  },
  {
    name: "Rutalink",
    description: "Rastreo satelital: GPS, candados, equipos móviles, cámaras y tags Bluetooth",
    color: "#b85d0f",
    products: [
      ["GPS vehicular", ProductType.PRODUCTO],
      ["Candado satelital", ProductType.PRODUCTO],
      ["Rastreo de equipos móviles", ProductType.SERVICIO],
      ["Cámara con GPS", ProductType.PRODUCTO],
      ["Sticker / Tag Bluetooth", ProductType.PRODUCTO],
      ["Servicio de monitoreo mensual", ProductType.SERVICIO],
    ],
  },
  {
    name: "Ludus",
    description: "Representación de Ludus – plataforma de realidad virtual (ludusglobal.com)",
    color: "#b0106d",
    products: [
      ["Licencia plataforma Ludus VR", ProductType.SERVICIO],
      ["Gafas de realidad virtual", ProductType.PRODUCTO],
    ],
  },
  {
    name: "Humand",
    description: "Representación de Humand – app de comunicación interna y RR.HH. (humand.co)",
    color: "#5f7a12",
    products: [
      ["Licencia Humand (por usuario)", ProductType.SERVICIO],
      ["Implementación Humand", ProductType.SERVICIO],
    ],
  },
];

async function main() {
  // Los usuarios se crean solo si no existen: nunca se sobrescriben contraseñas ya cambiadas.
  const password = process.env.SEED_INITIAL_PASSWORD;
  if (!password || password.length < 8) {
    console.warn("SEED_INITIAL_PASSWORD no está definida (mín. 8 caracteres): no se crearán usuarios.");
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    for (const u of TEAM) {
      await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, passwordHash } });
    }
  }

  if ((await prisma.pipelineStage.count()) === 0) {
    await prisma.pipelineStage.createMany({
      data: STAGES.map((s, i) => ({ ...s, order: i })),
    });
  }

  for (const line of LINES) {
    const existing = await prisma.businessLine.findUnique({ where: { name: line.name } });
    if (existing) {
      // Activa los campos de proyecto de E-learning si la línea aún no tiene campos configurados
      if (line.name === "E-learning" && Array.isArray(existing.customFields) && existing.customFields.length === 0) {
        await prisma.businessLine.update({ where: { id: existing.id }, data: { customFields: ELEARNING_FIELDS } });
      }
      continue;
    }
    await prisma.businessLine.create({
      data: {
        name: line.name,
        description: line.description,
        color: line.color,
        customFields: line.name === "E-learning" ? ELEARNING_FIELDS : [],
        products: { create: line.products.map(([name, type]) => ({ name, type })) },
      },
    });
  }

  console.log("Seed listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
