-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "changed_fields",
ADD COLUMN     "new_values" JSONB,
ADD COLUMN     "old_values" JSONB,
ADD COLUMN     "user_agent" VARCHAR(512);

-- Create set_current_user_agent context helper function
CREATE OR REPLACE FUNCTION set_current_user_agent(ua_text text) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_agent', ua_text, true);
END;
$$ LANGUAGE plpgsql;

-- Recreate audit trigger function to handle old_values, new_values, and user_agent
CREATE OR REPLACE FUNCTION process_audit_log() RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid;
  v_client_ip varchar(45);
  v_user_agent varchar(512);
  v_row_id uuid;
  v_old_values jsonb;
  v_new_values jsonb;
  k text;
  v jsonb;
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

  -- Determine user_agent from context
  BEGIN
    v_user_agent := NULLIF(current_setting('app.current_user_agent', true), '');
  EXCEPTION WHEN OTHERS THEN
    v_user_agent := NULL;
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

  -- Calculate old_values and new_values dynamically
  IF TG_OP = 'INSERT' THEN
    v_old_values := NULL;
    v_new_values := row_to_json(NEW)::jsonb - 'password_hash';
  ELSIF TG_OP = 'DELETE' THEN
    v_old_values := row_to_json(OLD)::jsonb - 'password_hash';
    v_new_values := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := '{}'::jsonb;
    v_new_values := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(row_to_json(NEW)::jsonb) LOOP
      IF k = 'password_hash' THEN
        CONTINUE;
      END IF;
      IF NOT (row_to_json(OLD)::jsonb) ? k OR (row_to_json(OLD)::jsonb)->k IS DISTINCT FROM v THEN
        v_old_values := v_old_values || jsonb_build_object(k, (row_to_json(OLD)::jsonb)->k);
        v_new_values := v_new_values || jsonb_build_object(k, v);
      END IF;
    END LOOP;

    -- Avoid logging if no fields were actually changed
    IF v_new_values = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Record the audit entry
  INSERT INTO audit_logs (tenant_id, user_id, action, table_name, row_id, old_values, new_values, client_ip, user_agent, created_at)
  VALUES (
    v_tenant_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_old_values,
    v_new_values,
    v_client_ip,
    v_user_agent,
    CURRENT_TIMESTAMP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
