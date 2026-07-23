-- Reconcile the canonical PostgreSQL 15/PostGIS database with schema.prisma.
-- Existing shipment delivery data is preserved by renaming the old column.

ALTER TABLE "cart_items"
ADD COLUMN "metadata" JSONB,
ADD COLUMN "product_id" UUID,
ADD COLUMN "subtotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "unit_price" DECIMAL(12,4) NOT NULL DEFAULT 0;

ALTER TABLE "carts"
ADD COLUMN "discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "session_id" VARCHAR(255),
ADD COLUMN "shipping" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "subtotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "tax" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "total" DECIMAL(12,4) NOT NULL DEFAULT 0,
ALTER COLUMN "currency" SET DEFAULT 'USD';

ALTER TABLE "order_items"
ADD COLUMN "metadata" JSONB,
ADD COLUMN "product_id" UUID,
ADD COLUMN "product_name" VARCHAR(255),
ADD COLUMN "sku" VARCHAR(100),
ADD COLUMN "subtotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "variant_name" VARCHAR(255),
ALTER COLUMN "tax_rate" SET DEFAULT 0;

ALTER TABLE "orders"
ADD COLUMN "billing_address" JSONB,
ADD COLUMN "cart_id" UUID,
ADD COLUMN "checkout_id" UUID,
ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN "discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
ADD COLUMN "metadata" JSONB,
ADD COLUMN "notes" VARCHAR(1000),
ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "payments"
ADD COLUMN "external_transaction_id" VARCHAR(255),
ADD COLUMN "failure_reason" VARCHAR(500),
ADD COLUMN "metadata" JSONB,
ADD COLUMN "payment_reference" VARCHAR(255),
ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "store_id" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "transaction_id" DROP NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'USD';

ALTER TABLE "shipments"
RENAME COLUMN "estimated_delivery" TO "estimated_delivery_date";

ALTER TABLE "shipments"
ADD COLUMN "fulfillment_id" UUID,
ADD COLUMN "metadata" JSONB,
ADD COLUMN "service_level" VARCHAR(50),
ADD COLUMN "shipping_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN "shipping_label_reference" VARCHAR(255),
ADD COLUMN "store_id" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TABLE "checkouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "customer_id" UUID,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "status" "CheckoutStatus" NOT NULL DEFAULT 'DRAFT',
    "customer_info" JSONB,
    "billing_address" JSONB,
    "shipping_address" JSONB,
    "shipping_method" JSONB,
    "coupon_code" VARCHAR(50),
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipment_tracking_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "carrier_status" VARCHAR(100),
    "location" VARCHAR(255),
    "notes" VARCHAR(500),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipment_tracking_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "checkouts_tenant_id_cart_id_idx" ON "checkouts"("tenant_id", "cart_id");
CREATE INDEX "checkouts_tenant_id_store_id_idx" ON "checkouts"("tenant_id", "store_id");
CREATE INDEX "checkouts_tenant_id_customer_id_idx" ON "checkouts"("tenant_id", "customer_id");
CREATE INDEX "shipment_tracking_histories_tenant_id_shipment_id_timestamp_idx" ON "shipment_tracking_histories"("tenant_id", "shipment_id", "timestamp");
CREATE INDEX "carts_tenant_id_session_id_idx" ON "carts"("tenant_id", "session_id");
CREATE INDEX "payments_tenant_id_payment_reference_idx" ON "payments"("tenant_id", "payment_reference");
CREATE INDEX "shipments_tenant_id_order_id_idx" ON "shipments"("tenant_id", "order_id");

ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_tracking_histories" ADD CONSTRAINT "shipment_tracking_histories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_tracking_histories" ADD CONSTRAINT "shipment_tracking_histories_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
