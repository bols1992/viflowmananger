import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Try argon2 first, fallback to bcrypt
async function hashPassword(password: string): Promise<string> {
  try {
    const argon2 = await import('argon2');
    return argon2.hash(password);
  } catch {
    console.warn('⚠️  Using bcrypt instead of argon2');
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 12);
  }
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123!';

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      role: 'ADMIN', // String literal statt Enum
    },
  });

  console.log(`✅ Admin user created/updated: ${admin.username}`);
  console.log(`⚠️  SECURITY WARNING: Change the admin password before production deployment!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
