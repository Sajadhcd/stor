import { PrismaClient, TenantStatus, OrderStatus, TransactionStatus, ShipmentStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...')

  // 1. Clean Database (Delete in reverse dependency order)
  console.log('Cleaning existing records...')
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';")
    await tx.auditLog.deleteMany()
    await tx.shipment.deleteMany()
    await tx.transaction.deleteMany()
    await tx.orderItem.deleteMany()
    await tx.order.deleteMany()
    await tx.cartItem.deleteMany()
    await tx.cart.deleteMany()
    await tx.customer.deleteMany()
    await tx.stockLevel.deleteMany()
    await tx.productVariant.deleteMany()
    await tx.categoriesOnProducts.deleteMany()
    await tx.product.deleteMany()
    await tx.category.deleteMany()
    await tx.warehouse.deleteMany()
    await tx.branchesOnStores.deleteMany()
    await tx.branch.deleteMany()
    await tx.store.deleteMany()
    await tx.user.deleteMany()
    await tx.tenant.deleteMany()
  })

  console.log('Database clean completed.')

  // 2. Seed Tenants
  console.log('Seeding tenants...')
  const tenantVelo = await prisma.tenant.create({
    data: {
      id: '9c85b40e-5f51-4668-a9bb-f9320d309052',
      name: 'Velo Activewear',
      subdomain: 'velo',
      customDomain: 'veloactivewear.com',
      status: TenantStatus.ACTIVE,
      subscriptionTier: 'ENTERPRISE',
    },
  })

  const tenantScribble = await prisma.tenant.create({
    data: {
      name: 'Scribble Stationery',
      subdomain: 'scribble',
      customDomain: null,
      status: TenantStatus.ACTIVE,
      subscriptionTier: 'BASIC',
    },
  })

  const platformTenant = await prisma.tenant.create({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Nexio Platform Administration',
      subdomain: 'platform',
      status: TenantStatus.ACTIVE,
      subscriptionTier: 'ENTERPRISE',
    },
  })

  // 3. Seed Users (Staff Users) — Passwords hashed with Argon2id
  console.log('Seeding staff users...')
  const adminPassword = await argon2.hash('Admin@123');
  const scribblePassword = await argon2.hash('Admin@123');

  const userVeloAdmin = await prisma.user.create({
    data: {
      tenantId: tenantVelo.id,
      email: 'admin@veloactivewear.com',
      passwordHash: adminPassword,
      name: 'Sarah Jenkins',
      roleId: 'tenant_owner',
      status: 'ACTIVE',
    },
  })

  const userScribbleAdmin = await prisma.user.create({
    data: {
      tenantId: tenantScribble.id,
      email: 'admin@scribble.com',
      passwordHash: scribblePassword,
      name: 'Michael Scott',
      roleId: 'tenant_owner',
      status: 'ACTIVE',
    },
  })

  await prisma.user.create({
    data: {
      tenantId: platformTenant.id,
      email: 'platform@nexio.iq',
      passwordHash: adminPassword,
      name: 'Nexio Platform Administrator',
      roleId: 'platform_admin',
      status: 'ACTIVE',
    },
  })

  // 4. Seed Stores
  console.log('Seeding stores...')
  const storeVeloSa = await prisma.store.create({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      tenantId: tenantVelo.id,
      name: 'Velo Saudi Store',
      currency: 'SAR',
      languageDefault: 'ar',
    },
  })

  const storeVeloEu = await prisma.store.create({
    data: {
      tenantId: tenantVelo.id,
      name: 'Velo European Store',
      currency: 'EUR',
      languageDefault: 'en',
    },
  })

  const storeScribbleUs = await prisma.store.create({
    data: {
      tenantId: tenantScribble.id,
      name: 'Scribble US Bookshop',
      currency: 'USD',
      languageDefault: 'en',
    },
  })

  // 5. Seed Branches
  console.log('Seeding branches...')
  const branchVeloRiyadh = await prisma.branch.create({
    data: {
      tenantId: tenantVelo.id,
      name: 'Riyadh Main Showroom',
      address: {
        street: 'Olaya Street',
        city: 'Riyadh',
        country: 'Saudi Arabia',
        postal_code: '12211',
      },
    },
  })

  const branchVeloJeddah = await prisma.branch.create({
    data: {
      tenantId: tenantVelo.id,
      name: 'Jeddah Mall Branch',
      address: {
        street: 'Tahlia Street',
        city: 'Jeddah',
        country: 'Saudi Arabia',
        postal_code: '23326',
      },
    },
  })

  const branchScribbleNy = await prisma.branch.create({
    data: {
      tenantId: tenantScribble.id,
      name: 'Scribble Manhattan Outlet',
      address: {
        street: '5th Avenue',
        city: 'New York',
        country: 'United States',
        postal_code: '10001',
      },
    },
  })

  // 6. Link Branches to Stores
  console.log('Linking branches to stores...')
  await prisma.branchesOnStores.createMany({
    data: [
      { tenantId: tenantVelo.id, storeId: storeVeloSa.id, branchId: branchVeloRiyadh.id },
      { tenantId: tenantVelo.id, storeId: storeVeloSa.id, branchId: branchVeloJeddah.id },
      { tenantId: tenantVelo.id, storeId: storeVeloEu.id, branchId: branchVeloRiyadh.id },
      { tenantId: tenantScribble.id, storeId: storeScribbleUs.id, branchId: branchScribbleNy.id },
    ],
  })

  // 7. Seed Warehouses & postgis polygon update
  console.log('Seeding warehouses...')
  const warehouseVeloRiyadh = await prisma.warehouse.create({
    data: {
      tenantId: tenantVelo.id,
      branchId: branchVeloRiyadh.id,
      name: 'Riyadh Central Logistics Hub',
      isActive: true,
    },
  })

  const warehouseVeloJeddah = await prisma.warehouse.create({
    data: {
      tenantId: tenantVelo.id,
      branchId: branchVeloJeddah.id,
      name: 'Jeddah Port Warehouse',
      isActive: true,
    },
  })

  const warehouseScribbleNy = await prisma.warehouse.create({
    data: {
      tenantId: tenantScribble.id,
      branchId: branchScribbleNy.id,
      name: 'NY Brooklyn Warehouse',
      isActive: true,
    },
  })

  // Update PostGIS location polygon for warehouses dynamically
  console.log('Executing raw SQL for spatial polygon updates...')
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE warehouses 
      SET location_polygon = ST_GeomFromText('POLYGON((46.60 24.60, 46.70 24.60, 46.70 24.70, 46.60 24.70, 46.60 24.60))', 4326)
      WHERE id = '${warehouseVeloRiyadh.id}'
    `)
    await prisma.$executeRawUnsafe(`
      UPDATE warehouses 
      SET location_polygon = ST_GeomFromText('POLYGON((39.10 21.40, 39.20 21.40, 39.20 21.50, 39.10 21.50, 39.10 21.40))', 4326)
      WHERE id = '${warehouseVeloJeddah.id}'
    `)
  } catch (err: any) {
    console.warn('Spatial polygon update skipped (PostGIS extension optional):', err.message);
  }

  // 8. Seed Categories
  console.log('Seeding categories...')
  const catApparel = await prisma.category.create({
    data: {
      tenantId: tenantVelo.id,
      nameTranslations: { en: 'Apparel', ar: 'ملابس' },
      slug: 'apparel',
    },
  })

  const catFootwear = await prisma.category.create({
    data: {
      tenantId: tenantVelo.id,
      parentId: catApparel.id,
      nameTranslations: { en: 'Footwear', ar: 'أحذية' },
      slug: 'footwear',
    },
  })

  const catStationery = await prisma.category.create({
    data: {
      tenantId: tenantScribble.id,
      nameTranslations: { en: 'Office Supplies' },
      slug: 'office-supplies',
    },
  })

  // 9. Seed Products
  console.log('Seeding products...')
  const prodVeloTee = await prisma.product.create({
    data: {
      tenantId: tenantVelo.id,
      storeId: storeVeloSa.id,
      titleTranslations: { en: 'Velo Pro Tech Tee', ar: 'تي شيرت فيلو برو الرياضي' },
      descriptionTranslations: {
        en: 'High-performance moisture-wicking training shirt.',
        ar: 'قميص تدريب رياضي عالي الأداء طارد للرطوبة.',
      },
      attributes: { material: 'Polyester Blend', fit: 'Athletic Fit', gender: 'unisex' },
      isPublished: true,
    },
  })

  const prodVeloSneaker = await prisma.product.create({
    data: {
      tenantId: tenantVelo.id,
      storeId: storeVeloSa.id,
      titleTranslations: { en: 'Velo Apex Run Sneaker', ar: 'حذاء الجري فيلو أبيكس' },
      descriptionTranslations: {
        en: 'Lightweight carbon-plated marathon running shoes.',
        ar: 'حذاء جري خفيف الوزن مزود بلوح كربون للماراثون.',
      },
      attributes: { upper: 'Breathable Knit', cushioning: 'Apex Foam', offset: '8mm' },
      isPublished: true,
    },
  })

  const prodScribbleJournal = await prisma.product.create({
    data: {
      tenantId: tenantScribble.id,
      storeId: storeScribbleUs.id,
      titleTranslations: { en: 'Scribble Dot Grid Journal' },
      descriptionTranslations: { en: 'Premium 160 GSM dotted paper notebook for journaling.' },
      attributes: { paper_weight: '160 GSM', binding: 'Hardcover', pages: 160 },
      isPublished: true,
    },
  })

  // Link products to categories
  console.log('Linking products to categories...')
  await prisma.categoriesOnProducts.createMany({
    data: [
      { tenantId: tenantVelo.id, productId: prodVeloTee.id, categoryId: catApparel.id },
      { tenantId: tenantVelo.id, productId: prodVeloSneaker.id, categoryId: catFootwear.id },
      { tenantId: tenantScribble.id, productId: prodScribbleJournal.id, categoryId: catStationery.id },
    ],
  })

  // 10. Seed Product Variants
  console.log('Seeding product variants...')
  const varTeeM = await prisma.productVariant.create({
    data: {
      id: '21880085-f414-4947-9acc-5299dfabb80f',
      tenantId: tenantVelo.id,
      productId: prodVeloTee.id,
      sku: 'VELO-TEE-BLK-M',
      barcode: '628109283710',
      price: 120.0000,
      costPrice: 45.0000,
      weight: 0.220,
    },
  })

  const varTeeL = await prisma.productVariant.create({
    data: {
      tenantId: tenantVelo.id,
      productId: prodVeloTee.id,
      sku: 'VELO-TEE-BLK-L',
      barcode: '628109283711',
      price: 120.0000,
      costPrice: 45.0000,
      weight: 0.250,
    },
  })

  const varSneaker42 = await prisma.productVariant.create({
    data: {
      tenantId: tenantVelo.id,
      productId: prodVeloSneaker.id,
      sku: 'VELO-APX-BLU-42',
      barcode: '628109284200',
      price: 450.0000,
      costPrice: 160.0000,
      weight: 0.820,
    },
  })

  const varJournalNavy = await prisma.productVariant.create({
    data: {
      tenantId: tenantScribble.id,
      productId: prodScribbleJournal.id,
      sku: 'SCR-JRNL-NVY',
      barcode: '190283710293',
      price: 24.9900,
      costPrice: 7.5000,
      weight: 0.380,
    },
  })

  // 11. Seed Stock Levels
  console.log('Seeding stock levels...')
  await prisma.stockLevel.createMany({
    data: [
      {
        tenantId: tenantVelo.id,
        warehouseId: warehouseVeloRiyadh.id,
        variantId: varTeeM.id,
        quantityPhysical: 150,
        quantityReserved: 12,
      },
      {
        tenantId: tenantVelo.id,
        warehouseId: warehouseVeloJeddah.id,
        variantId: varTeeM.id,
        quantityPhysical: 80,
        quantityReserved: 0,
      },
      {
        tenantId: tenantVelo.id,
        warehouseId: warehouseVeloRiyadh.id,
        variantId: varTeeL.id,
        quantityPhysical: 120,
        quantityReserved: 5,
      },
      {
        tenantId: tenantVelo.id,
        warehouseId: warehouseVeloRiyadh.id,
        variantId: varSneaker42.id,
        quantityPhysical: 40,
        quantityReserved: 3,
      },
      {
        tenantId: tenantScribble.id,
        warehouseId: warehouseScribbleNy.id,
        variantId: varJournalNavy.id,
        quantityPhysical: 350,
        quantityReserved: 24,
      },
    ],
  })

  // 12. Seed Customers
  console.log('Seeding customers...')
  const customerVelo = await prisma.customer.create({
    data: {
      tenantId: tenantVelo.id,
      email: 'yasmin.otaibi@gmail.com',
      name: 'Yasmin Al-Otaibi',
      phone: '+966507654321',
    },
  })

  const customerScribble = await prisma.customer.create({
    data: {
      tenantId: tenantScribble.id,
      email: 'john.doe@gmail.com',
      name: 'John Doe',
      phone: '+15552345678',
    },
  })

  // 13. Seed Sample Carts (Shopping Carts)
  console.log('Seeding shopping carts...')
  const cartVelo = await prisma.cart.create({
    data: {
      tenantId: tenantVelo.id,
      storeId: storeVeloSa.id,
      customerId: customerVelo.id,
      currency: 'SAR',
      couponCode: 'WELCOME10',
    },
  })

  await prisma.cartItem.create({
    data: {
      tenantId: tenantVelo.id,
      cartId: cartVelo.id,
      variantId: varTeeM.id,
      quantity: 2,
    },
  })

  // 14. Seed Orders, Order Items, Transactions & Shipments
  console.log('Seeding orders pipeline...')
  const orderVelo = await prisma.order.create({
    data: {
      tenantId: tenantVelo.id,
      storeId: storeVeloSa.id,
      customerId: customerVelo.id,
      orderNumber: 'ORD-2026-10001',
      status: OrderStatus.PAID,
      subtotal: 690.0000,
      taxTotal: 103.5000, // 15% VAT
      shippingTotal: 25.0000,
      grandTotal: 818.5000,
      shippingAddress: {
        recipient_name: 'Yasmin Al-Otaibi',
        street_address: '7821 King Fahd Road',
        neighborhood: 'Al-Yasmin',
        city: 'Riyadh',
        country: 'Saudi Arabia',
        phone: '+966507654321',
      },
    },
  })

  await prisma.orderItem.createMany({
    data: [
      {
        tenantId: tenantVelo.id,
        orderId: orderVelo.id,
        variantId: varTeeM.id,
        priceUnit: 120.0000,
        quantity: 2,
        taxRate: 15.00,
      },
      {
        tenantId: tenantVelo.id,
        orderId: orderVelo.id,
        variantId: varSneaker42.id,
        priceUnit: 450.0000,
        quantity: 1,
        taxRate: 15.00,
      },
    ],
  })

  // Payment Transaction for Order
  await prisma.transaction.create({
    data: {
      tenantId: tenantVelo.id,
      orderId: orderVelo.id,
      gateway: 'ADYEN',
      gatewayTransactionId: 'ady_tx_9018237190',
      amount: 818.5000,
      status: TransactionStatus.CAPTURED,
    },
  })

  // Courier Shipment for Order
  await prisma.shipment.create({
    data: {
      tenantId: tenantVelo.id,
      orderId: orderVelo.id,
      carrier: 'DHL_EXPRESS',
      trackingNumber: 'JD014920381029',
      status: ShipmentStatus.IN_TRANSIT,
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    },
  })

  // 15. Seed Audit Logs
  console.log('Seeding administrative audit logs...')
  await prisma.auditLog.create({
    data: {
      tenantId: tenantVelo.id,
      userId: userVeloAdmin.id,
      action: 'INSERT',
      tableName: 'products',
      rowId: prodVeloSneaker.id,
      newValues: {
        is_published: true,
        title_translations: { en: 'Velo Apex Run Sneaker', ar: 'حذاء الجري فيلو أبيكس' },
      },
      clientIp: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    },
  })

  console.log('Database seeding finished successfully! 🚀');
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
