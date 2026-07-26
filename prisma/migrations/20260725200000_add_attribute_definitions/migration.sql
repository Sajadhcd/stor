-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('select', 'text', 'color', 'number', 'boolean');

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"           UUID         NOT NULL,
    "category_id"         UUID,
    "name"                VARCHAR(100) NOT NULL,
    "label_translations"  JSONB        NOT NULL,
    "type"                "AttributeType" NOT NULL DEFAULT 'select',
    "options"             JSONB,
    "is_required"         BOOLEAN      NOT NULL DEFAULT false,
    "position"            INTEGER      NOT NULL DEFAULT 0,
    "is_variant_axis"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attribute_definitions_tenant_id_category_id_position_idx"
    ON "attribute_definitions" ("tenant_id", "category_id", "position");

-- CreateIndex (unique: one definition name per tenant+category pair)
CREATE UNIQUE INDEX "attribute_definitions_tenant_id_category_id_name_key"
    ON "attribute_definitions" ("tenant_id", "category_id", "name");

-- AddForeignKey
ALTER TABLE "attribute_definitions"
    ADD CONSTRAINT "attribute_definitions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenants" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_definitions"
    ADD CONSTRAINT "attribute_definitions_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "categories" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- GIN index on product_variants.attributes for fast JSON-path filtering
-- Prisma cannot generate GIN indexes natively; this must remain as raw SQL.
-- jsonb_path_ops supports the @? and @@ operators used in attribute filters.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "product_variants_attributes_gin_idx"
    ON "product_variants" USING GIN ("attributes" jsonb_path_ops);
