-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_variants_attributes_idx" ON "product_variants" USING gin ("attributes" jsonb_path_ops);
