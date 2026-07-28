-- 1. Make audit_logs.tenant_id nullable
ALTER TABLE "audit_logs" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- 2. Drop the existing cascading foreign key
ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_tenant_id_fkey";

-- 3. Recreate it with ON DELETE SET NULL to preserve the ledger
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" 
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Update process_audit_log to handle tenant deletions gracefully
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
      IF TG_OP = 'DELETE' THEN
        -- When deleting a tenant, the audit log must not reference the deleted ID,
        -- otherwise ON DELETE SET NULL will instantly orphan it or cause an FK violation.
        v_tenant_id := NULL;
      ELSE
        v_tenant_id := COALESCE(NEW.id, OLD.id);
      END IF;
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

  v_row_id := COALESCE(NEW.id, OLD.id);
  v_old_values := NULL;
  v_new_values := NULL;

  IF TG_OP = 'INSERT' THEN
    v_new_values := to_jsonb(NEW);
    -- Redact sensitive fields if any
    IF v_new_values ? 'password_hash' THEN
      v_new_values := v_new_values - 'password_hash';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := '{}'::jsonb;
    v_new_values := '{}'::jsonb;
    
    FOR k, v IN SELECT key, value FROM jsonb_each(to_jsonb(OLD))
    LOOP
      IF v IS DISTINCT FROM (to_jsonb(NEW)->k) THEN
        v_old_values := jsonb_set(v_old_values, ARRAY[k], v);
        v_new_values := jsonb_set(v_new_values, ARRAY[k], to_jsonb(NEW)->k);
      END IF;
    END LOOP;

    -- Redact sensitive fields
    IF v_old_values ? 'password_hash' THEN
      v_old_values := v_old_values - 'password_hash';
    END IF;
    IF v_new_values ? 'password_hash' THEN
      v_new_values := v_new_values - 'password_hash';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    -- Redact sensitive fields
    IF v_old_values ? 'password_hash' THEN
      v_old_values := v_old_values - 'password_hash';
    END IF;
  END IF;

  -- Only log if there are changes
  IF TG_OP != 'UPDATE' OR (v_old_values != '{}'::jsonb) THEN
    INSERT INTO "audit_logs" (
      "tenant_id", "user_id", "action", "table_name", "row_id", 
      "old_values", "new_values", "client_ip", "user_agent"
    ) VALUES (
      v_tenant_id, v_user_id, TG_OP, TG_TABLE_NAME, v_row_id,
      v_old_values, v_new_values,
      v_client_ip, v_user_agent
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
