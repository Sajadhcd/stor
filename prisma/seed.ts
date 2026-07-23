import {
  OrderStatus,
  PrismaClient,
  ShipmentStatus,
  TenantStatus,
  TransactionStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ids = {
  tenantVelo: '9c85b40e-5f51-4668-a9bb-f9320d309052',
  tenantScribble: '9c85b40e-5f51-4668-a9bb-f9320d309053',
  tenantPlatform: '00000000-0000-4000-8000-000000000001',
  storeVeloSa: '11111111-1111-4111-8111-111111111111',
  storeVeloEu: '11111111-1111-4111-8111-111111111112',
  storeScribbleUs: '11111111-1111-4111-8111-111111111113',
  branchVeloRiyadh: '22222222-2222-4222-8222-222222222221',
  branchVeloJeddah: '22222222-2222-4222-8222-222222222222',
  branchScribbleNy: '22222222-2222-4222-8222-222222222223',
  warehouseVeloRiyadh: '33333333-3333-4333-8333-333333333331',
  warehouseVeloJeddah: '33333333-3333-4333-8333-333333333332',
  warehouseScribbleNy: '33333333-3333-4333-8333-333333333333',
  categoryApparel: '44444444-4444-4444-8444-444444444441',
  categoryFootwear: '44444444-4444-4444-8444-444444444442',
  categoryStationery: '44444444-4444-4444-8444-444444444443',
  productVeloTee: '55555555-5555-4555-8555-555555555551',
  productVeloSneaker: '55555555-5555-4555-8555-555555555552',
  productScribbleJournal: '55555555-5555-4555-8555-555555555553',
  variantTeeM: '21880085-f414-4947-9acc-5299dfabb80f',
  variantTeeL: '66666666-6666-4666-8666-666666666662',
  variantSneaker42: '66666666-6666-4666-8666-666666666663',
  variantJournalNavy: '66666666-6666-4666-8666-666666666664',
  customerVelo: '77777777-7777-4777-8777-777777777771',
  customerScribble: '77777777-7777-4777-8777-777777777772',
  cartVelo: '88888888-8888-4888-8888-888888888881',
  cartItemVelo: '99999999-9999-4999-8999-999999999991',
  orderVelo: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  orderItemTee: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  orderItemSneaker: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  transactionVelo: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  shipmentVelo: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
} as const;

function getSeedPassword(): string {
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD;
  if (configuredPassword) {
    return configuredPassword;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SEED_ADMIN_PASSWORD is required when NODE_ENV=production');
  }
  return 'Admin@123';
}

async function main() {
  console.log('Starting deterministic database seed...');
  const passwordHash = await argon2.hash(getSeedPassword(), {
    type: argon2.argon2id,
  });

  await prisma.$transaction(
    async (tx) => {
      // Seed maintenance should not create business audit events. Referential
      // integrity is still enforced by the ordered upserts below.
      await tx.$executeRaw`SET LOCAL session_replication_role = 'replica'`;

      const tenantVelo = await tx.tenant.upsert({
        where: { subdomain: 'velo' },
        update: {
          name: 'Velo Activewear',
          customDomain: 'veloactivewear.com',
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'ENTERPRISE',
        },
        create: {
          id: ids.tenantVelo,
          name: 'Velo Activewear',
          subdomain: 'velo',
          customDomain: 'veloactivewear.com',
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'ENTERPRISE',
        },
      });
      const tenantScribble = await tx.tenant.upsert({
        where: { subdomain: 'scribble' },
        update: {
          name: 'Scribble Stationery',
          customDomain: null,
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'BASIC',
        },
        create: {
          id: ids.tenantScribble,
          name: 'Scribble Stationery',
          subdomain: 'scribble',
          customDomain: null,
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'BASIC',
        },
      });
      const tenantPlatform = await tx.tenant.upsert({
        where: { subdomain: 'platform' },
        update: {
          name: 'Nexio Platform Administration',
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'ENTERPRISE',
        },
        create: {
          id: ids.tenantPlatform,
          name: 'Nexio Platform Administration',
          subdomain: 'platform',
          status: TenantStatus.ACTIVE,
          subscriptionTier: 'ENTERPRISE',
        },
      });

      const userVeloAdmin = await tx.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenantVelo.id,
            email: 'admin@veloactivewear.com',
          },
        },
        update: {
          passwordHash,
          name: 'Sarah Jenkins',
          roleId: 'tenant_owner',
          status: 'ACTIVE',
        },
        create: {
          tenantId: tenantVelo.id,
          email: 'admin@veloactivewear.com',
          passwordHash,
          name: 'Sarah Jenkins',
          roleId: 'tenant_owner',
          status: 'ACTIVE',
        },
      });
      await tx.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenantScribble.id,
            email: 'admin@scribble.com',
          },
        },
        update: {
          passwordHash,
          name: 'Michael Scott',
          roleId: 'tenant_owner',
          status: 'ACTIVE',
        },
        create: {
          tenantId: tenantScribble.id,
          email: 'admin@scribble.com',
          passwordHash,
          name: 'Michael Scott',
          roleId: 'tenant_owner',
          status: 'ACTIVE',
        },
      });
      await tx.user.upsert({
        where: {
          tenantId_email: {
            tenantId: tenantPlatform.id,
            email: 'platform@nexio.iq',
          },
        },
        update: {
          passwordHash,
          name: 'Nexio Platform Administrator',
          roleId: 'platform_admin',
          status: 'ACTIVE',
        },
        create: {
          tenantId: tenantPlatform.id,
          email: 'platform@nexio.iq',
          passwordHash,
          name: 'Nexio Platform Administrator',
          roleId: 'platform_admin',
          status: 'ACTIVE',
        },
      });

      const existingStoreVeloSa = await tx.store.findFirst({
        where: { tenantId: tenantVelo.id, name: 'Velo Saudi Store' },
        select: { id: true },
      });
      const storeVeloSa = await tx.store.upsert({
        where: { id: existingStoreVeloSa?.id ?? ids.storeVeloSa },
        update: { name: 'Velo Saudi Store', currency: 'SAR', languageDefault: 'ar' },
        create: {
          id: ids.storeVeloSa,
          tenantId: tenantVelo.id,
          name: 'Velo Saudi Store',
          currency: 'SAR',
          languageDefault: 'ar',
        },
      });
      const existingStoreVeloEu = await tx.store.findFirst({
        where: { tenantId: tenantVelo.id, name: 'Velo European Store' },
        select: { id: true },
      });
      const storeVeloEu = await tx.store.upsert({
        where: { id: existingStoreVeloEu?.id ?? ids.storeVeloEu },
        update: { name: 'Velo European Store', currency: 'EUR', languageDefault: 'en' },
        create: {
          id: ids.storeVeloEu,
          tenantId: tenantVelo.id,
          name: 'Velo European Store',
          currency: 'EUR',
          languageDefault: 'en',
        },
      });
      const existingStoreScribbleUs = await tx.store.findFirst({
        where: { tenantId: tenantScribble.id, name: 'Scribble US Bookshop' },
        select: { id: true },
      });
      const storeScribbleUs = await tx.store.upsert({
        where: { id: existingStoreScribbleUs?.id ?? ids.storeScribbleUs },
        update: { name: 'Scribble US Bookshop', currency: 'USD', languageDefault: 'en' },
        create: {
          id: ids.storeScribbleUs,
          tenantId: tenantScribble.id,
          name: 'Scribble US Bookshop',
          currency: 'USD',
          languageDefault: 'en',
        },
      });

      const branchDefinitions = [
        {
          id: ids.branchVeloRiyadh,
          tenantId: tenantVelo.id,
          name: 'Riyadh Main Showroom',
          address: {
            street: 'Olaya Street',
            city: 'Riyadh',
            country: 'Saudi Arabia',
            postal_code: '12211',
          },
        },
        {
          id: ids.branchVeloJeddah,
          tenantId: tenantVelo.id,
          name: 'Jeddah Mall Branch',
          address: {
            street: 'Tahlia Street',
            city: 'Jeddah',
            country: 'Saudi Arabia',
            postal_code: '23326',
          },
        },
        {
          id: ids.branchScribbleNy,
          tenantId: tenantScribble.id,
          name: 'Scribble Manhattan Outlet',
          address: {
            street: '5th Avenue',
            city: 'New York',
            country: 'United States',
            postal_code: '10001',
          },
        },
      ] as const;
      const branches = [];
      for (const definition of branchDefinitions) {
        const existing = await tx.branch.findFirst({
          where: { tenantId: definition.tenantId, name: definition.name },
          select: { id: true },
        });
        branches.push(
          await tx.branch.upsert({
            where: { id: existing?.id ?? definition.id },
            update: { name: definition.name, address: definition.address },
            create: definition,
          }),
        );
      }
      const [branchVeloRiyadh, branchVeloJeddah, branchScribbleNy] = branches;

      for (const link of [
        { tenantId: tenantVelo.id, storeId: storeVeloSa.id, branchId: branchVeloRiyadh.id },
        { tenantId: tenantVelo.id, storeId: storeVeloSa.id, branchId: branchVeloJeddah.id },
        { tenantId: tenantVelo.id, storeId: storeVeloEu.id, branchId: branchVeloRiyadh.id },
        { tenantId: tenantScribble.id, storeId: storeScribbleUs.id, branchId: branchScribbleNy.id },
      ]) {
        await tx.branchesOnStores.upsert({
          where: { tenantId_storeId_branchId: link },
          update: {},
          create: link,
        });
      }

      const warehouseDefinitions = [
        {
          id: ids.warehouseVeloRiyadh,
          tenantId: tenantVelo.id,
          branchId: branchVeloRiyadh.id,
          name: 'Riyadh Central Logistics Hub',
        },
        {
          id: ids.warehouseVeloJeddah,
          tenantId: tenantVelo.id,
          branchId: branchVeloJeddah.id,
          name: 'Jeddah Port Warehouse',
        },
        {
          id: ids.warehouseScribbleNy,
          tenantId: tenantScribble.id,
          branchId: branchScribbleNy.id,
          name: 'NY Brooklyn Warehouse',
        },
      ] as const;
      const warehouses = [];
      for (const definition of warehouseDefinitions) {
        const existing = await tx.warehouse.findFirst({
          where: { tenantId: definition.tenantId, name: definition.name },
          select: { id: true },
        });
        warehouses.push(
          await tx.warehouse.upsert({
            where: { id: existing?.id ?? definition.id },
            update: {
              branchId: definition.branchId,
              name: definition.name,
              isActive: true,
            },
            create: { ...definition, isActive: true },
          }),
        );
      }
      const [warehouseVeloRiyadh, warehouseVeloJeddah, warehouseScribbleNy] = warehouses;

      await tx.$executeRaw`
        UPDATE warehouses
        SET location_polygon = ST_GeomFromText(
          'POLYGON((46.60 24.60, 46.70 24.60, 46.70 24.70, 46.60 24.70, 46.60 24.60))',
          4326
        )
        WHERE id = ${warehouseVeloRiyadh.id}::uuid
      `;
      await tx.$executeRaw`
        UPDATE warehouses
        SET location_polygon = ST_GeomFromText(
          'POLYGON((39.10 21.40, 39.20 21.40, 39.20 21.50, 39.10 21.50, 39.10 21.40))',
          4326
        )
        WHERE id = ${warehouseVeloJeddah.id}::uuid
      `;

      const categoryApparel = await tx.category.upsert({
        where: { tenantId_slug: { tenantId: tenantVelo.id, slug: 'apparel' } },
        update: { nameTranslations: { en: 'Apparel', ar: 'ملابس' }, parentId: null },
        create: {
          id: ids.categoryApparel,
          tenantId: tenantVelo.id,
          nameTranslations: { en: 'Apparel', ar: 'ملابس' },
          slug: 'apparel',
        },
      });
      const categoryFootwear = await tx.category.upsert({
        where: { tenantId_slug: { tenantId: tenantVelo.id, slug: 'footwear' } },
        update: {
          parentId: categoryApparel.id,
          nameTranslations: { en: 'Footwear', ar: 'أحذية' },
        },
        create: {
          id: ids.categoryFootwear,
          tenantId: tenantVelo.id,
          parentId: categoryApparel.id,
          nameTranslations: { en: 'Footwear', ar: 'أحذية' },
          slug: 'footwear',
        },
      });
      const categoryStationery = await tx.category.upsert({
        where: {
          tenantId_slug: { tenantId: tenantScribble.id, slug: 'office-supplies' },
        },
        update: { nameTranslations: { en: 'Office Supplies' }, parentId: null },
        create: {
          id: ids.categoryStationery,
          tenantId: tenantScribble.id,
          nameTranslations: { en: 'Office Supplies' },
          slug: 'office-supplies',
        },
      });

      const productDefinitions = [
        {
          id: ids.productVeloTee,
          tenantId: tenantVelo.id,
          storeId: storeVeloSa.id,
          sku: 'VELO-TEE-BLK-M',
          titleTranslations: { en: 'Velo Pro Tech Tee', ar: 'تي شيرت فيلو برو الرياضي' },
          descriptionTranslations: {
            en: 'High-performance moisture-wicking training shirt.',
            ar: 'قميص تدريب رياضي عالي الأداء طارد للرطوبة.',
          },
          attributes: {
            material: 'Polyester Blend',
            fit: 'Athletic Fit',
            gender: 'unisex',
          },
        },
        {
          id: ids.productVeloSneaker,
          tenantId: tenantVelo.id,
          storeId: storeVeloSa.id,
          sku: 'VELO-APX-BLU-42',
          titleTranslations: { en: 'Velo Apex Run Sneaker', ar: 'حذاء الجري فيلو أبيكس' },
          descriptionTranslations: {
            en: 'Lightweight carbon-plated marathon running shoes.',
            ar: 'حذاء جري خفيف الوزن مزود بلوح كربون للماراثون.',
          },
          attributes: {
            upper: 'Breathable Knit',
            cushioning: 'Apex Foam',
            offset: '8mm',
          },
        },
        {
          id: ids.productScribbleJournal,
          tenantId: tenantScribble.id,
          storeId: storeScribbleUs.id,
          sku: 'SCR-JRNL-NVY',
          titleTranslations: { en: 'Scribble Dot Grid Journal' },
          descriptionTranslations: {
            en: 'Premium 160 GSM dotted paper notebook for journaling.',
          },
          attributes: { paper_weight: '160 GSM', binding: 'Hardcover', pages: 160 },
        },
      ] as const;
      const products = [];
      for (const definition of productDefinitions) {
        const existing = await tx.product.findFirst({
          where: {
            tenantId: definition.tenantId,
            variants: { some: { sku: definition.sku } },
          },
          select: { id: true },
        });
        const data = {
          storeId: definition.storeId,
          titleTranslations: definition.titleTranslations,
          descriptionTranslations: definition.descriptionTranslations,
          attributes: definition.attributes,
          isPublished: true,
          deletedAt: null,
        };
        products.push(
          await tx.product.upsert({
            where: { id: existing?.id ?? definition.id },
            update: data,
            create: {
              id: definition.id,
              tenantId: definition.tenantId,
              ...data,
            },
          }),
        );
      }
      const [productVeloTee, productVeloSneaker, productScribbleJournal] = products;

      for (const link of [
        {
          tenantId: tenantVelo.id,
          productId: productVeloTee.id,
          categoryId: categoryApparel.id,
        },
        {
          tenantId: tenantVelo.id,
          productId: productVeloSneaker.id,
          categoryId: categoryFootwear.id,
        },
        {
          tenantId: tenantScribble.id,
          productId: productScribbleJournal.id,
          categoryId: categoryStationery.id,
        },
      ]) {
        await tx.categoriesOnProducts.upsert({
          where: { tenantId_productId_categoryId: link },
          update: {},
          create: link,
        });
      }

      const variantTeeM = await tx.productVariant.upsert({
        where: { tenantId_sku: { tenantId: tenantVelo.id, sku: 'VELO-TEE-BLK-M' } },
        update: {
          productId: productVeloTee.id,
          barcode: '628109283710',
          price: '120.0000',
          costPrice: '45.0000',
          weight: '0.220',
        },
        create: {
          id: ids.variantTeeM,
          tenantId: tenantVelo.id,
          productId: productVeloTee.id,
          sku: 'VELO-TEE-BLK-M',
          barcode: '628109283710',
          price: '120.0000',
          costPrice: '45.0000',
          weight: '0.220',
        },
      });
      const variantTeeL = await tx.productVariant.upsert({
        where: { tenantId_sku: { tenantId: tenantVelo.id, sku: 'VELO-TEE-BLK-L' } },
        update: {
          productId: productVeloTee.id,
          barcode: '628109283711',
          price: '120.0000',
          costPrice: '45.0000',
          weight: '0.250',
        },
        create: {
          id: ids.variantTeeL,
          tenantId: tenantVelo.id,
          productId: productVeloTee.id,
          sku: 'VELO-TEE-BLK-L',
          barcode: '628109283711',
          price: '120.0000',
          costPrice: '45.0000',
          weight: '0.250',
        },
      });
      const variantSneaker42 = await tx.productVariant.upsert({
        where: {
          tenantId_sku: { tenantId: tenantVelo.id, sku: 'VELO-APX-BLU-42' },
        },
        update: {
          productId: productVeloSneaker.id,
          barcode: '628109284200',
          price: '450.0000',
          costPrice: '160.0000',
          weight: '0.820',
        },
        create: {
          id: ids.variantSneaker42,
          tenantId: tenantVelo.id,
          productId: productVeloSneaker.id,
          sku: 'VELO-APX-BLU-42',
          barcode: '628109284200',
          price: '450.0000',
          costPrice: '160.0000',
          weight: '0.820',
        },
      });
      const variantJournalNavy = await tx.productVariant.upsert({
        where: {
          tenantId_sku: { tenantId: tenantScribble.id, sku: 'SCR-JRNL-NVY' },
        },
        update: {
          productId: productScribbleJournal.id,
          barcode: '190283710293',
          price: '24.9900',
          costPrice: '7.5000',
          weight: '0.380',
        },
        create: {
          id: ids.variantJournalNavy,
          tenantId: tenantScribble.id,
          productId: productScribbleJournal.id,
          sku: 'SCR-JRNL-NVY',
          barcode: '190283710293',
          price: '24.9900',
          costPrice: '7.5000',
          weight: '0.380',
        },
      });

      for (const stock of [
        {
          tenantId: tenantVelo.id,
          warehouseId: warehouseVeloRiyadh.id,
          variantId: variantTeeM.id,
          quantityPhysical: 150,
          quantityReserved: 12,
        },
        {
          tenantId: tenantVelo.id,
          warehouseId: warehouseVeloJeddah.id,
          variantId: variantTeeM.id,
          quantityPhysical: 80,
          quantityReserved: 0,
        },
        {
          tenantId: tenantVelo.id,
          warehouseId: warehouseVeloRiyadh.id,
          variantId: variantTeeL.id,
          quantityPhysical: 120,
          quantityReserved: 5,
        },
        {
          tenantId: tenantVelo.id,
          warehouseId: warehouseVeloRiyadh.id,
          variantId: variantSneaker42.id,
          quantityPhysical: 40,
          quantityReserved: 3,
        },
        {
          tenantId: tenantScribble.id,
          warehouseId: warehouseScribbleNy.id,
          variantId: variantJournalNavy.id,
          quantityPhysical: 350,
          quantityReserved: 24,
        },
      ]) {
        await tx.stockLevel.upsert({
          where: {
            tenantId_warehouseId_variantId: {
              tenantId: stock.tenantId,
              warehouseId: stock.warehouseId,
              variantId: stock.variantId,
            },
          },
          update: {
            quantityPhysical: stock.quantityPhysical,
            quantityReserved: stock.quantityReserved,
          },
          create: stock,
        });
      }

      const customerVelo = await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId: tenantVelo.id,
            email: 'yasmin.otaibi@gmail.com',
          },
        },
        update: {
          name: 'Yasmin Al-Otaibi',
          phone: '+966507654321',
          totalOrders: 1,
          totalSpent: '818.5000',
        },
        create: {
          id: ids.customerVelo,
          tenantId: tenantVelo.id,
          email: 'yasmin.otaibi@gmail.com',
          name: 'Yasmin Al-Otaibi',
          phone: '+966507654321',
          totalOrders: 1,
          totalSpent: '818.5000',
        },
      });
      await tx.customer.upsert({
        where: {
          tenantId_email: {
            tenantId: tenantScribble.id,
            email: 'john.doe@gmail.com',
          },
        },
        update: { name: 'John Doe', phone: '+15552345678' },
        create: {
          id: ids.customerScribble,
          tenantId: tenantScribble.id,
          email: 'john.doe@gmail.com',
          name: 'John Doe',
          phone: '+15552345678',
        },
      });

      const existingCart = await tx.cart.findFirst({
        where: {
          tenantId: tenantVelo.id,
          customerId: customerVelo.id,
          couponCode: 'WELCOME10',
        },
        select: { id: true },
      });
      const cartVelo = await tx.cart.upsert({
        where: { id: existingCart?.id ?? ids.cartVelo },
        update: {
          storeId: storeVeloSa.id,
          customerId: customerVelo.id,
          status: 'ACTIVE',
          currency: 'SAR',
          subtotal: '240.0000',
          discount: '0',
          tax: '0',
          shipping: '0',
          total: '240.0000',
          couponCode: 'WELCOME10',
        },
        create: {
          id: ids.cartVelo,
          tenantId: tenantVelo.id,
          storeId: storeVeloSa.id,
          customerId: customerVelo.id,
          status: 'ACTIVE',
          currency: 'SAR',
          subtotal: '240.0000',
          total: '240.0000',
          couponCode: 'WELCOME10',
        },
      });
      await tx.cartItem.upsert({
        where: {
          tenantId_cartId_variantId: {
            tenantId: tenantVelo.id,
            cartId: cartVelo.id,
            variantId: variantTeeM.id,
          },
        },
        update: {
          productId: productVeloTee.id,
          quantity: 2,
          unitPrice: '120.0000',
          subtotal: '240.0000',
        },
        create: {
          id: ids.cartItemVelo,
          tenantId: tenantVelo.id,
          cartId: cartVelo.id,
          productId: productVeloTee.id,
          variantId: variantTeeM.id,
          quantity: 2,
          unitPrice: '120.0000',
          subtotal: '240.0000',
        },
      });

      const orderVelo = await tx.order.upsert({
        where: {
          tenantId_orderNumber: {
            tenantId: tenantVelo.id,
            orderNumber: 'ORD-2026-10001',
          },
        },
        update: {
          storeId: storeVeloSa.id,
          cartId: cartVelo.id,
          customerId: customerVelo.id,
          currency: 'SAR',
          status: OrderStatus.PAID,
          paymentStatus: 'PAID',
          fulfillmentStatus: 'PROCESSING',
          subtotal: '690.0000',
          discount: '0',
          taxTotal: '103.5000',
          shippingTotal: '25.0000',
          grandTotal: '818.5000',
          shippingAddress: {
            recipient_name: 'Yasmin Al-Otaibi',
            street_address: '7821 King Fahd Road',
            neighborhood: 'Al-Yasmin',
            city: 'Riyadh',
            country: 'Saudi Arabia',
            phone: '+966507654321',
          },
        },
        create: {
          id: ids.orderVelo,
          tenantId: tenantVelo.id,
          storeId: storeVeloSa.id,
          cartId: cartVelo.id,
          customerId: customerVelo.id,
          orderNumber: 'ORD-2026-10001',
          currency: 'SAR',
          status: OrderStatus.PAID,
          paymentStatus: 'PAID',
          fulfillmentStatus: 'PROCESSING',
          subtotal: '690.0000',
          taxTotal: '103.5000',
          shippingTotal: '25.0000',
          grandTotal: '818.5000',
          shippingAddress: {
            recipient_name: 'Yasmin Al-Otaibi',
            street_address: '7821 King Fahd Road',
            neighborhood: 'Al-Yasmin',
            city: 'Riyadh',
            country: 'Saudi Arabia',
            phone: '+966507654321',
          },
        },
      });

      for (const item of [
        {
          id: ids.orderItemTee,
          productId: productVeloTee.id,
          variantId: variantTeeM.id,
          sku: 'VELO-TEE-BLK-M',
          productName: 'Velo Pro Tech Tee',
          priceUnit: '120.0000',
          quantity: 2,
          taxRate: '15.00',
          subtotal: '240.0000',
        },
        {
          id: ids.orderItemSneaker,
          productId: productVeloSneaker.id,
          variantId: variantSneaker42.id,
          sku: 'VELO-APX-BLU-42',
          productName: 'Velo Apex Run Sneaker',
          priceUnit: '450.0000',
          quantity: 1,
          taxRate: '15.00',
          subtotal: '450.0000',
        },
      ]) {
        const existing = await tx.orderItem.findFirst({
          where: {
            tenantId: tenantVelo.id,
            orderId: orderVelo.id,
            variantId: item.variantId,
          },
          select: { id: true },
        });
        const itemId = existing?.id ?? item.id;
        await tx.orderItem.upsert({
          where: { tenantId_id: { tenantId: tenantVelo.id, id: itemId } },
          update: {
            orderId: orderVelo.id,
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            productName: item.productName,
            priceUnit: item.priceUnit,
            quantity: item.quantity,
            taxRate: item.taxRate,
            subtotal: item.subtotal,
          },
          create: {
            id: item.id,
            tenantId: tenantVelo.id,
            orderId: orderVelo.id,
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            productName: item.productName,
            priceUnit: item.priceUnit,
            quantity: item.quantity,
            taxRate: item.taxRate,
            subtotal: item.subtotal,
          },
        });
      }

      await tx.transaction.upsert({
        where: {
          tenantId_gateway_gatewayTransactionId: {
            tenantId: tenantVelo.id,
            gateway: 'ADYEN',
            gatewayTransactionId: 'ady_tx_9018237190',
          },
        },
        update: {
          orderId: orderVelo.id,
          amount: '818.5000',
          status: TransactionStatus.CAPTURED,
        },
        create: {
          id: ids.transactionVelo,
          tenantId: tenantVelo.id,
          orderId: orderVelo.id,
          gateway: 'ADYEN',
          gatewayTransactionId: 'ady_tx_9018237190',
          amount: '818.5000',
          status: TransactionStatus.CAPTURED,
        },
      });

      const existingShipment = await tx.shipment.findFirst({
        where: {
          tenantId: tenantVelo.id,
          trackingNumber: 'JD014920381029',
        },
        select: { id: true },
      });
      await tx.shipment.upsert({
        where: { id: existingShipment?.id ?? ids.shipmentVelo },
        update: {
          storeId: storeVeloSa.id,
          orderId: orderVelo.id,
          carrier: 'DHL_EXPRESS',
          trackingNumber: 'JD014920381029',
          status: ShipmentStatus.IN_TRANSIT,
          estimatedDeliveryDate: new Date('2026-07-25T12:00:00.000Z'),
        },
        create: {
          id: ids.shipmentVelo,
          tenantId: tenantVelo.id,
          storeId: storeVeloSa.id,
          orderId: orderVelo.id,
          carrier: 'DHL_EXPRESS',
          trackingNumber: 'JD014920381029',
          status: ShipmentStatus.IN_TRANSIT,
          estimatedDeliveryDate: new Date('2026-07-25T12:00:00.000Z'),
        },
      });

      await tx.auditLog.upsert({
        where: { id: 900000000000000001n },
        update: {
          tenantId: tenantVelo.id,
          userId: userVeloAdmin.id,
          action: 'SEED_BASELINE',
          tableName: 'products',
          rowId: productVeloSneaker.id,
          newValues: {
            is_published: true,
            title: 'Velo Apex Run Sneaker',
          },
          clientIp: '127.0.0.1',
          userAgent: 'Nexio deterministic seed',
        },
        create: {
          id: 900000000000000001n,
          tenantId: tenantVelo.id,
          userId: userVeloAdmin.id,
          action: 'SEED_BASELINE',
          tableName: 'products',
          rowId: productVeloSneaker.id,
          newValues: {
            is_published: true,
            title: 'Velo Apex Run Sneaker',
          },
          clientIp: '127.0.0.1',
          userAgent: 'Nexio deterministic seed',
        },
      });
    },
    { maxWait: 10_000, timeout: 60_000 },
  );

  console.log('Deterministic database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
