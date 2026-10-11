-- Habilita Row Level Security en todas las tablas del esquema public
-- (incluida _prisma_migrations). Supabase expone este esquema vía su API REST
-- (PostgREST); sin RLS, cualquiera con la anon key podría leer/escribir las tablas.
-- La app accede solo por Prisma con el rol postgres, que ignora RLS. Se añade una
-- política explícita que niega todo a anon/authenticated: la API pública queda
-- sin acceso y el CRM sigue igual. Es idempotente (se puede ejecutar varias veces).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "sin_acceso_api" ON public.%I', t.tablename);
    EXECUTE format('CREATE POLICY "sin_acceso_api" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t.tablename);
  END LOOP;
END $$;
