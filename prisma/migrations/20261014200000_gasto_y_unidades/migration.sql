-- Gasto adicional del proyecto (confidencial, como el costo del desarrollo)
ALTER TABLE "Deal" ADD COLUMN "extraExpense" DECIMAL(14,2);

-- «Tiempo de desarrollo»: en lugar de «semanas» fijo, se elige días o semanas
UPDATE "BusinessLine" b SET "customFields" = (
  SELECT jsonb_agg(CASE WHEN f->>'key' = 'tiempoDesarrollo' AND f->>'type' = 'number' THEN (f - 'suffix') || '{"units":["días","semanas"]}'::jsonb ELSE f END ORDER BY ord)
  FROM jsonb_array_elements(b."customFields") WITH ORDINALITY AS t(f, ord)
)
WHERE jsonb_typeof(b."customFields") = 'array' AND b."customFields" @> '[{"key":"tiempoDesarrollo"}]';

-- Los tiempos ya registrados estaban en semanas
UPDATE "Deal" SET "customData" = "customData" || '{"tiempoDesarrolloUnidad":"semanas"}'::jsonb
WHERE "customData" ? 'tiempoDesarrollo' AND NOT ("customData" ? 'tiempoDesarrolloUnidad');
