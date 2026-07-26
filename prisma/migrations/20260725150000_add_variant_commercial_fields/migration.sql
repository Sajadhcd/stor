-- AlterTable
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "price_override"   DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "compare_at_price"  DECIMAL(12, 4),
  ADD COLUMN IF NOT EXISTS "variant_name"     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "is_active"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "position"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dimensions"        JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_variants_tenant_id_is_active_position_idx"
  ON "product_variants" ("tenant_id", "is_active", "position");
