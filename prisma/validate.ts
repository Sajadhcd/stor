import { PrismaClient } from '@prisma/client'

// Admin client connects as postgres superuser (to setup mock user/IP, seed, read logs)
const adminPrisma = new PrismaClient()

// App client connects as db_user non-superuser (to verify RLS enforcement)
const appPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://db_user:db_user@localhost:5432/nexio_commerce?schema=public'
    }
  }
})

async function main() {
  console.log('--- START DATABASE VALIDATION ---')

  // 1. Get tenants list using admin client (since db_user doesn't have tenant context yet and can't read tenants)
  const allTenants = await adminPrisma.tenant.findMany()
  console.log(`Found ${allTenants.length} tenants in total.`)
  
  const veloTenant = allTenants.find(t => t.subdomain === 'velo')!
  const scribbleTenant = allTenants.find(t => t.subdomain === 'scribble')!

  // 2. Check if RLS blocks access for db_user when no tenant context is set
  console.log('\nChecking non-superuser access (no tenant context set):')
  try {
    const noContextProducts = await appPrisma.product.findMany()
    console.log(`Products returned (no context): ${noContextProducts.length} (Expected: 0)`)
  } catch (error) {
    console.error('Error querying without context:', error)
  }

  // 3. Set tenant context to Velo and see if we are restricted to Velo's data
  console.log(`\nSetting tenant context to Velo (${veloTenant.id}):`)
  await appPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET app.current_tenant_id = '${veloTenant.id}';`)
    const veloProducts = await tx.product.findMany()
    console.log(`Velo products count: ${veloProducts.length}`)
    veloProducts.forEach(p => {
      console.log(`- Product: ${JSON.stringify(p.titleTranslations)} (tenant_id: ${p.tenantId})`)
    })
  })

  // 4. Set tenant context to Scribble and see if we are restricted to Scribble's data
  console.log(`\nSetting tenant context to Scribble (${scribbleTenant.id}):`)
  await appPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET app.current_tenant_id = '${scribbleTenant.id}';`)
    const scribbleProducts = await tx.product.findMany()
    console.log(`Scribble products count: ${scribbleProducts.length}`)
    scribbleProducts.forEach(p => {
      console.log(`- Product: ${JSON.stringify(p.titleTranslations)} (tenant_id: ${p.tenantId})`)
    })
  })

  // 5. Test Audit Triggers & Writes under RLS
  console.log('\nTesting Audit Triggers & Writes (under Velo context):')
  
  let newProductId = ''
  await appPrisma.$transaction(async (tx) => {
    // Set tenant context, user context, and client IP context
    await tx.$executeRawUnsafe(`SET app.current_tenant_id = '${veloTenant.id}';`)
    
    const mockUserId = '11111111-2222-3333-4444-555555555555'
    await tx.$executeRawUnsafe(`SET app.current_user_id = '${mockUserId}';`)
    await tx.$executeRawUnsafe(`SET app.current_client_ip = '10.0.0.1';`)
    await tx.$executeRawUnsafe(`SET app.current_user_agent = 'PostmanRuntime/7.32.2';`)

    // Create a product
    console.log('Inserting new product for validation...')
    const store = await tx.store.findFirst() // should automatically be Velo's store because of RLS!
    console.log(`Found store: ${store?.name} (tenant_id: ${store?.tenantId})`)
    
    const newProduct = await tx.product.create({
      data: {
        tenantId: veloTenant.id,
        storeId: store!.id,
        titleTranslations: { en: 'Validation Tee' },
        isPublished: false
      }
    })
    newProductId = newProduct.id
    console.log(`Product inserted with ID: ${newProduct.id}`)

    // Update the product
    console.log('Updating product...')
    await tx.product.update({
      where: { id: newProduct.id },
      data: { isPublished: true, attributes: { size: 'L' } }
    })

    // Delete the product
    console.log('Deleting product...')
    await tx.product.delete({
      where: { id: newProduct.id }
    })
  })

  // Verify audit logs using admin client
  console.log('\nQuerying generated audit logs for the product ID:')
  const auditLogs = await adminPrisma.auditLog.findMany({
    where: { rowId: newProductId },
    orderBy: { id: 'asc' }
  })
  
  console.log(`Found ${auditLogs.length} audit logs:`)
  auditLogs.forEach(log => {
    console.log(`- Action: ${log.action}, Table: ${log.tableName}, User: ${log.userId}, IP: ${log.clientIp}, UA: ${log.userAgent}\n  Old: ${JSON.stringify(log.oldValues)}\n  New: ${JSON.stringify(log.newValues)}`)
  })

  console.log('--- END DATABASE VALIDATION ---')
}

main()
  .catch((e) => {
    console.error('Validation failed:', e)
  })
  .finally(async () => {
    await adminPrisma.$disconnect()
    await appPrisma.$disconnect()
  })
