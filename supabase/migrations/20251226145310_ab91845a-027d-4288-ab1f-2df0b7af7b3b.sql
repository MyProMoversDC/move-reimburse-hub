-- Fix linter WARN: extensions installed in public schema
-- Create dedicated schema for extensions and move common extensions if present
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext text;
BEGIN
  FOREACH ext IN ARRAY ARRAY['pgcrypto','uuid-ossp','citext','pg_trgm','unaccent','vector']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname = ext) THEN
      -- only move if currently in public
      IF EXISTS (
        SELECT 1
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = ext AND n.nspname = 'public'
      ) THEN
        EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions;', ext);
      END IF;
    END IF;
  END LOOP;
END $$;