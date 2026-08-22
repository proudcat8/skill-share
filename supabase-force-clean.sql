-- Run this in Supabase SQL Editor to see what exists
SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'auth') AND tablename IN ('users', 'posts', 'likes', 'comments', 'conversations', 'conversation_members', 'messages', 'sessions');

-- Then run this to force drop everything in public schema
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- Now run the full schema (copy from supabase-schema.sql after this)