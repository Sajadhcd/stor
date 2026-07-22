-- Create db_user role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'db_user') THEN
    CREATE ROLE db_user WITH LOGIN PASSWORD 'db_user';
  END IF;
END
$$;

-- Grant schema and table permissions
GRANT USAGE ON SCHEMA public TO db_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO db_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO db_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO db_user;

-- Ensure default privileges for future tables/sequences/functions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO db_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO db_user;

-- Create tenant context helper functions
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_current_tenant_id(tenant_uuid uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_current_user_id(user_uuid uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_uuid::text, true);
END;
$$ LANGUAGE plpgsql;

-- Create JSONB diff utility function
CREATE OR REPLACE FUNCTION jsonb_diff(val_old jsonb, val_new jsonb)
RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  k text;
  v jsonb;
BEGIN
  IF val_new IS NULL THEN
    -- DELETE: return all old fields, excluding sensitive password hash
    RETURN val_old - 'password_hash';
  ELSIF val_old IS NULL THEN
    -- INSERT: return all new fields, excluding sensitive password hash
    RETURN val_new - 'password_hash';
  ELSE
    -- UPDATE: return changed fields, excluding sensitive password hash
    FOR k, v IN SELECT * FROM jsonb_each(val_new) LOOP
      IF k = 'password_hash' THEN
        CONTINUE;
      END IF;
      IF NOT val_old ? k OR val_old->k IS DISTINCT FROM v THEN
        result := result || jsonb_build_object(k, v);
      END IF;
    END LOOP;
    RETURN result;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_client_ip varchar(45);
  v_row_id uuid;
  v_changed_fields jsonb;
BEGIN
  -- Determine tenant_id from context or from row
  v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
  IF v_tenant_id IS NULL THEN
    IF TG_TABLE_NAME = 'tenants' THEN
      v_tenant_id := COALESCE(NEW.id, OLD.id);
    ELSE
      v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
    END IF;
  END IF;

  -- Determine user_id from context
  BEGIN
    v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Determine client_ip from context
  BEGIN
    v_client_ip := NULLIF(current_setting('app.current_client_ip', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  -- Determine row_id (handling composite primary keys gracefully)
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_row_id := OLD.id;
    ELSE
      v_row_id := NEW.id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    IF TG_TABLE_NAME = 'stock_levels' THEN
      v_row_id := md5(concat(
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        COALESCE(NEW.warehouse_id, OLD.warehouse_id),
        COALESCE(NEW.variant_id, OLD.variant_id)
      ))::uuid;
    ELSIF TG_TABLE_NAME = 'branches_stores' THEN
      v_row_id := md5(concat(
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        COALESCE(NEW.store_id, OLD.store_id),
        COALESCE(NEW.branch_id, OLD.branch_id)
      ))::uuid;
    ELSIF TG_TABLE_NAME = 'categories_products' THEN
      v_row_id := md5(concat(
        COALESCE(NEW.tenant_id, OLD.tenant_id),
        COALESCE(NEW.product_id, OLD.product_id),
        COALESCE(NEW.category_id, OLD.category_id)
      ))::uuid;
    ELSE
      v_row_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
  END;

  -- Calculate diff of fields
  IF TG_OP = 'INSERT' THEN
    v_changed_fields := jsonb_diff(NULL, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    v_changed_fields := jsonb_diff(row_to_json(OLD)::jsonb, NULL);
  ELSE
    v_changed_fields := jsonb_diff(row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  END IF;

  -- Avoid writing to audit logs if no fields were changed (in case of UPDATE)
  IF TG_OP = 'UPDATE' AND v_changed_fields = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Record the audit entry
  INSERT INTO audit_logs (tenant_id, user_id, action, table_name, row_id, changed_fields, client_ip, created_at)
  VALUES (
    v_tenant_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_changed_fields,
    v_client_ip,
    CURRENT_TIMESTAMP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row-Level Security & Force Row-Level Security on all tenant-owned tables
-- And create tenant isolation policies

-- 1. users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "users" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 2. stores
ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stores" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "stores" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 3. branches
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "branches" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 4. branches_stores
ALTER TABLE "branches_stores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches_stores" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "branches_stores" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 5. warehouses
ALTER TABLE "warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "warehouses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "warehouses" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 6. categories
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "categories" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 7. products
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "products" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 8. categories_products
ALTER TABLE "categories_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories_products" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "categories_products" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 9. product_variants
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "product_variants" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 10. stock_levels
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "stock_levels" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 11. customers
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "customers" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 12. carts
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "carts" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 13. cart_items
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cart_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "cart_items" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 14. orders
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "orders" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 15. order_items
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "order_items" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 16. transactions
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "transactions" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 17. shipments
ALTER TABLE "shipments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "shipments" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);

-- 18. audit_logs
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "audit_logs" FOR ALL USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  OR (current_setting('is_superuser', true) = 'on' AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NULL)
);


-- Create Audit Triggers on all tables (except audit_logs)

-- 1. tenants
CREATE TRIGGER audit_trigger_tenants
  AFTER INSERT OR UPDATE OR DELETE ON "tenants"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 2. users
CREATE TRIGGER audit_trigger_users
  AFTER INSERT OR UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 3. stores
CREATE TRIGGER audit_trigger_stores
  AFTER INSERT OR UPDATE OR DELETE ON "stores"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 4. branches
CREATE TRIGGER audit_trigger_branches
  AFTER INSERT OR UPDATE OR DELETE ON "branches"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 5. branches_stores
CREATE TRIGGER audit_trigger_branches_stores
  AFTER INSERT OR UPDATE OR DELETE ON "branches_stores"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 6. warehouses
CREATE TRIGGER audit_trigger_warehouses
  AFTER INSERT OR UPDATE OR DELETE ON "warehouses"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 7. categories
CREATE TRIGGER audit_trigger_categories
  AFTER INSERT OR UPDATE OR DELETE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 8. products
CREATE TRIGGER audit_trigger_products
  AFTER INSERT OR UPDATE OR DELETE ON "products"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 9. categories_products
CREATE TRIGGER audit_trigger_categories_products
  AFTER INSERT OR UPDATE OR DELETE ON "categories_products"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 10. product_variants
CREATE TRIGGER audit_trigger_product_variants
  AFTER INSERT OR UPDATE OR DELETE ON "product_variants"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 11. stock_levels
CREATE TRIGGER audit_trigger_stock_levels
  AFTER INSERT OR UPDATE OR DELETE ON "stock_levels"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 12. customers
CREATE TRIGGER audit_trigger_customers
  AFTER INSERT OR UPDATE OR DELETE ON "customers"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 13. carts
CREATE TRIGGER audit_trigger_carts
  AFTER INSERT OR UPDATE OR DELETE ON "carts"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 14. cart_items
CREATE TRIGGER audit_trigger_cart_items
  AFTER INSERT OR UPDATE OR DELETE ON "cart_items"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 15. orders
CREATE TRIGGER audit_trigger_orders
  AFTER INSERT OR UPDATE OR DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 16. order_items
CREATE TRIGGER audit_trigger_order_items
  AFTER INSERT OR UPDATE OR DELETE ON "order_items"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 17. transactions
CREATE TRIGGER audit_trigger_transactions
  AFTER INSERT OR UPDATE OR DELETE ON "transactions"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 18. shipments
CREATE TRIGGER audit_trigger_shipments
  AFTER INSERT OR UPDATE OR DELETE ON "shipments"
  FOR EACH ROW EXECUTE FUNCTION process_audit_log();