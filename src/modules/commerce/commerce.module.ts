import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { SalesModule } from './sales/sales.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { FulfillmentModule } from './fulfillment/fulfillment.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { LocalizationModule } from './localization/localization.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { AccountingModule } from './accounting/accounting.module.js';
import { InstallmentsModule } from './installments/installments.module.js';
import { CartModule } from './cart/cart.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { ShippingModule } from './shipping/shipping.module.js';

@Module({
  imports: [
    CatalogModule,
    InventoryModule,
    SalesModule,
    PaymentsModule,
    FulfillmentModule,
    CustomersModule,
    LocalizationModule,
    LocationsModule,
    AccountingModule,
    InstallmentsModule,
    CartModule,
    CheckoutModule,
    ShippingModule,
  ],
  exports: [
    CatalogModule,
    InventoryModule,
    SalesModule,
    PaymentsModule,
    FulfillmentModule,
    CustomersModule,
    LocalizationModule,
    LocationsModule,
    AccountingModule,
    InstallmentsModule,
    CartModule,
    CheckoutModule,
    ShippingModule,
  ],
})
export class CommerceModule {}
