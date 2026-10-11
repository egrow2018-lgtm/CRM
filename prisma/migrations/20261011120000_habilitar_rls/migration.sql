-- Habilita Row Level Security en todas las tablas del esquema public
-- (incluida _prisma_migrations). Supabase expone este esquema vía su API REST
-- (PostgREST); sin RLS, cualquiera con la anon key podría leer/escribir las tablas.
-- La app accede solo por Prisma con el rol postgres, que ignora RLS, así que
-- no se crean políticas: la API pública queda sin acceso y el CRM sigue igual.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
