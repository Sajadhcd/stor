-- Establish the non-superuser runtime role without embedding credentials.
-- Docker initialization or the deployment secret manager enables LOGIN and
-- supplies the password. The legacy default-credential role is disabled.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nexio_app'
  ) THEN
    CREATE ROLE nexio_app
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT;
  END IF;
END
$$;

ALTER ROLE nexio_app
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'db_user'
  ) THEN
    ALTER ROLE db_user NOLOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO nexio_app',
    current_database()
  );
END
$$;

GRANT USAGE ON SCHEMA public TO nexio_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nexio_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nexio_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nexio_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO nexio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO nexio_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nexio_app;
