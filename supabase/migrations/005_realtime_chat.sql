-- Enable authorised Postgres Changes subscriptions; existing RLS policies still apply.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'The supabase_realtime publication is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensajes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversaciones') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones;
  END IF;
END $$;
