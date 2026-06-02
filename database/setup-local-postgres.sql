-- Run once as a PostgreSQL superuser (e.g. postgres) in pgAdmin or psql.
-- Creates the CACSMS application role and database used by DATABASE_URL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cacsms') THEN
    CREATE ROLE cacsms LOGIN PASSWORD 'Adm1n.c0m';
  ELSE
    ALTER ROLE cacsms WITH LOGIN PASSWORD 'Adm1n.c0m';
  END IF;
END
$$;

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'db_cacsms-engine' AND pid <> pg_backend_pid();
