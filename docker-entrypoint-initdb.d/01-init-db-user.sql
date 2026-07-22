-- Idempotent creation of db_user non-superuser runtime role required for PostgreSQL Row-Level Security (RLS)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'db_user') THEN
    CREATE ROLE db_user WITH LOGIN PASSWORD 'db_user';
  END IF;
END
$$;

-- Grant database connection and schema permissions to db_user
GRANT CONNECT ON DATABASE nexio_commerce TO db_user;
GRANT USAGE ON SCHEMA public TO db_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO db_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO db_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO db_user;

-- Ensure default privileges for future tables, sequences, and functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO db_user;
