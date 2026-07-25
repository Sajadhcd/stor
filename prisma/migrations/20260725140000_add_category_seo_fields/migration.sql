-- Phase A1: Extend categories table with SEO, media, hierarchy, and status fields
-- Migration is additive-only; no existing data is touched.

-- Add optional SEO & media columns to categories
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "image_url"                VARCHAR(1024),
  ADD COLUMN IF NOT EXISTS "description_translations" JSONB,
  ADD COLUMN IF NOT EXISTS "meta_title"               VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "meta_description"         VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "is_active"                BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "position"                 INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index to support ordered, active-only listings per tenant
CREATE INDEX IF NOT EXISTS "categories_tenant_id_is_active_position_idx"
  ON "categories" ("tenant_id", "is_active", "position");
