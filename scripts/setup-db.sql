-- Setup superuser password and create db_user non-superuser role for RLS
ALTER USER postgres WITH PASSWORD 'postgres';

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'db_user') THEN
    CREATE ROLE db_user WITH LOGIN PASSWORD 'db_user';
  ELSE
    ALTER ROLE db_user WITH LOGIN PASSWORD 'db_user';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE nexio_commerce TO db_user;
GRANT USAGE ON SCHEMA public TO db_user;
