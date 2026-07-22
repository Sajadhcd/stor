const { PrismaClient, TenantStatus } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL || 'platform@nexio.iq';
  const password = process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@123';
  if (process.env.NODE_ENV === 'production' && !process.env.PLATFORM_ADMIN_PASSWORD) {
    throw new Error('PLATFORM_ADMIN_PASSWORD is required in production');
  }

  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'platform' },
    update: { name: 'Nexio Platform Administration', status: TenantStatus.ACTIVE },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Nexio Platform Administration',
      subdomain: 'platform',
      status: TenantStatus.ACTIVE,
      subscriptionTier: 'ENTERPRISE',
    },
  });

  const passwordHash = await argon2.hash(password);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { passwordHash, name: 'Nexio Platform Administrator', roleId: 'platform_admin', status: 'ACTIVE' },
    create: {
      tenantId: tenant.id,
      email,
      passwordHash,
      name: 'Nexio Platform Administrator',
      roleId: 'platform_admin',
      status: 'ACTIVE',
    },
  });

  process.stdout.write(`Platform administrator provisioned: ${email}\n`);
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
