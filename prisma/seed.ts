import { PrismaClient, ProductType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STAGES = [
  { name: "Contacto", probability: 10 },
  { name: "Presentación", probability: 30 },
  { name: "Cotización-Envío", probability: 40 },
  { name: "Revisión-Negociación", probability: 70 },
  { name: "Firma de Contrato", probability: 80 },
  { name: "En Producción", probability: 90 },
  { name: "Cerrado Ganado", probability: 100, isWon: true },
  { name: "Cerrado Perdido", probability: 0, isLost: true },
];

const LINES: { name: string; description: string; color: string; products: [string, ProductType][] }[] = [
  {
    name: "E-learning",
    description: "Plataformas LMS, cursos virtuales y producción audiovisual",
    color: "#0f766e",
    products: [
      ["Plataforma LMS", ProductType.SERVICIO],
      ["Curso virtual", ProductType.SERVICIO],
      ["Producción audiovisual / Video learning", ProductType.SERVICIO],
    ],
  },
  {
    name: "Rutalink",
    description: "Rastreo satelital: GPS, candados, equipos móviles, cámaras y tags Bluetooth",
    color: "#1d4ed8",
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
    color: "#7c3aed",
    products: [
      ["Licencia plataforma Ludus VR", ProductType.SERVICIO],
      ["Gafas de realidad virtual", ProductType.PRODUCTO],
    ],
  },
  {
    name: "Humand",
    description: "Representación de Humand – app de comunicación interna y RR.HH. (humand.co)",
    color: "#db2777",
    products: [
      ["Licencia Humand (por usuario)", ProductType.SERVICIO],
      ["Implementación Humand", ProductType.SERVICIO],
    ],
  },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@e-grow.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "CambiaEsta123!";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });

  if ((await prisma.pipelineStage.count()) === 0) {
    await prisma.pipelineStage.createMany({
      data: STAGES.map((s, i) => ({ ...s, order: i })),
    });
  }

  for (const line of LINES) {
    const existing = await prisma.businessLine.findUnique({ where: { name: line.name } });
    if (existing) continue;
    await prisma.businessLine.create({
      data: {
        name: line.name,
        description: line.description,
        color: line.color,
        products: { create: line.products.map(([name, type]) => ({ name, type })) },
      },
    });
  }

  console.log(`Seed listo. Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
