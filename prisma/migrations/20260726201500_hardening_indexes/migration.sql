-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_variants_tenant_id_price_idx" ON "product_variants" ("tenant_id", "price");

-- CreateIndex (Partial index for active and published products)
CREATE INDEX IF NOT EXISTS "products_tenant_id_published_active_idx" ON "products" ("tenant_id") WHERE deleted_at IS NULL AND is_published = true;

-- CreateIndex (Trigram index on product slug)
CREATE INDEX IF NOT EXISTS "products_slug_trgm_idx" ON "products" USING gin ("slug" gin_trgm_ops);

-- CreateIndex (Trigram index on brand name)
CREATE INDEX IF NOT EXISTS "brands_name_trgm_idx" ON "brands" USING gin ("name" gin_trgm_ops);

-- CreateIndex (Trigram index on product variant SKU)
CREATE INDEX IF NOT EXISTS "product_variants_sku_trgm_idx" ON "product_variants" USING gin ("sku" gin_trgm_ops);

-- CreateIndex (Trigram index on Arabic product title translations)
CREATE INDEX IF NOT EXISTS "products_title_ar_trgm_idx" ON "products" USING gin (((title_translations->>'ar')) gin_trgm_ops);

-- CreateIndex (Trigram index on English product title translations)
CREATE INDEX IF NOT EXISTS "products_title_en_trgm_idx" ON "products" USING gin (((title_translations->>'en')) gin_trgm_ops);
