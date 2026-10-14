-- Costo del desarrollo de cada negocio (confidencial)
ALTER TABLE "Deal" ADD COLUMN "developmentCost" DECIMAL(14,2);

-- Equipo de desarrollo (lista administrada en Configuración)
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;

-- El campo «Equipo de desarrollo» pasa de texto libre a la lista del equipo
UPDATE "BusinessLine" b SET "customFields" = (
  SELECT jsonb_agg(CASE WHEN f->>'key' = 'equipo' AND f->>'type' = 'textarea' THEN (f - 'placeholder') || '{"type":"team"}'::jsonb ELSE f END ORDER BY ord)
  FROM jsonb_array_elements(b."customFields") WITH ORDINALITY AS t(f, ord)
)
WHERE jsonb_typeof(b."customFields") = 'array' AND b."customFields" @> '[{"key":"equipo"}]';

-- Quienes tienen permisos personalizados de Gerente o Proyectos conservan el acceso por defecto al costo
UPDATE "User" SET "permissions" = array_append("permissions", 'deals:cost')
WHERE "customPermissions" = true AND "role" IN ('GERENTE', 'PROYECTOS') AND NOT ('deals:cost' = ANY("permissions"));
