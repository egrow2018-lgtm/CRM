-- Se ejecuta en cada despliegue (vercel-build), después de las migraciones.
-- Activa RLS y bloquea la API pública de Supabase (anon/authenticated) en TODAS las
-- tablas de public, incluidas las que creen migraciones nuevas. La app usa Prisma con
-- el rol postgres, que ignora RLS. Es idempotente.
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
