-- Migration: 20260728140000_harden_vector_refresh_signature
-- Replaces the single-argument update_product_search_vector(uuid) with a
-- tenant-safe two-argument form. Revokes nexio_app access to the old form.
-- Does NOT drop the old form -- update_all_product_search_vectors still uses it
-- via the admin role; we replace that caller too.

-- ============================================================================
-- 1. Two-argument runtime refresh function (tenant-safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_search_vector(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title_en   TEXT;
  v_title_ar   TEXT;
  v_desc_en    TEXT;
  v_desc_ar    TEXT;
  v_slug       TEXT;
  v_brand_name TEXT;
  v_skus       TEXT;
  v_vector     TSVECTOR;
  v_arabic_cfg TEXT := 'simple';
BEGIN
  -- Determine available Arabic text-search configuration
  IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic') THEN
    v_arabic_cfg := 'arabic';
  END IF;

  -- Acquire a row-level lock on the product before reading search data.
  -- This prevents a concurrent refresh from computing a stale tsvector
  -- while another transaction is still writing title/brand/variant changes.
  -- The SKIP LOCKED variant is intentionally NOT used: we want to wait for
  -- the lock so the final vector always reflects committed data.
  PERFORM p.id
  FROM    products p
  WHERE   p.id        = p_product_id
    AND   p.tenant_id = p_tenant_id
  FOR UPDATE;

  -- If no row was found (wrong tenant or product does not exist), return
  -- silently. This is not an error; it prevents cross-tenant writes.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Read all search-relevant fields from the product row.
  -- brand join enforces tenant ownership: brands.tenant_id must match.
  SELECT
    p.title_translations->>'en',
    p.title_translations->>'ar',
    p.description_translations->>'en',
    p.description_translations->>'ar',
    p.slug,
    b.name
  INTO
    v_title_en, v_title_ar, v_desc_en, v_desc_ar, v_slug, v_brand_name
  FROM  products p
  LEFT JOIN brands b
         ON b.id        = p.brand_id
        AND b.tenant_id = p_tenant_id
  WHERE p.id        = p_product_id
    AND p.tenant_id = p_tenant_id;

  -- Aggregate SKUs from active, non-deleted variants only.
  -- tenant_id is enforced on both the join key and the explicit filter.
  -- ProductVariant has no deleted_at column, so only is_active is checked.
  SELECT coalesce(string_agg(pv.sku, ' ' ORDER BY pv.sku), '')
  INTO   v_skus
  FROM   product_variants pv
  WHERE  pv.product_id = p_product_id
    AND  pv.tenant_id  = p_tenant_id
    AND  pv.is_active  = true;

  -- Build the weighted tsvector.
  v_vector :=
    setweight(to_tsvector('english',            coalesce(v_title_en,                     '')), 'A') ||
    setweight(to_tsvector(v_arabic_cfg::regconfig, coalesce(normalize_arabic(v_title_ar),  '')), 'A') ||
    setweight(to_tsvector('english',            coalesce(v_brand_name,                   '')), 'B') ||
    setweight(to_tsvector('simple',             coalesce(v_skus,                         '')), 'B') ||
    setweight(to_tsvector('english',            coalesce(v_slug,                         '')), 'C') ||
    setweight(to_tsvector('english',            coalesce(v_desc_en,                      '')), 'D') ||
    setweight(to_tsvector(v_arabic_cfg::regconfig, coalesce(normalize_arabic(v_desc_ar),  '')), 'D');

  -- Write the vector back. tenant_id and id are both enforced in the WHERE
  -- clause to prevent any cross-tenant update, even under unexpected call paths.
  UPDATE products
  SET    tsv_search = v_vector
  WHERE  id         = p_product_id
    AND  tenant_id  = p_tenant_id;
END;
$$;

-- ============================================================================
-- 2. Update the batch refresh to call the new 2-argument form
-- ============================================================================

CREATE OR REPLACE FUNCTION update_all_product_search_vectors(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM products WHERE tenant_id = p_tenant_id
  LOOP
    PERFORM update_product_search_vector(p_tenant_id, r.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- 3. Privilege hardening
-- ============================================================================

-- Revoke PUBLIC access from everything (safety: functions default to PUBLIC)
REVOKE ALL ON FUNCTION update_product_search_vector(uuid)       FROM PUBLIC;
REVOKE ALL ON FUNCTION update_product_search_vector(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_all_product_search_vectors(uuid)  FROM PUBLIC;

-- Revoke nexio_app access to the old single-argument form
-- (nexio_app was previously granted this in 20260728100000_harden_fts_functions)
REVOKE EXECUTE ON FUNCTION update_product_search_vector(uuid)   FROM nexio_app;

-- Grant nexio_app only the new two-argument runtime form
GRANT EXECUTE ON FUNCTION update_product_search_vector(uuid, uuid) TO nexio_app;

-- nexio_admin retains access to both forms for tooling and manual repair
GRANT EXECUTE ON FUNCTION update_product_search_vector(uuid)        TO nexio_admin;
GRANT EXECUTE ON FUNCTION update_product_search_vector(uuid, uuid)  TO nexio_admin;

-- Bulk refresh remains admin-only: nexio_app must never call it directly
GRANT EXECUTE ON FUNCTION update_all_product_search_vectors(uuid)   TO nexio_admin;
