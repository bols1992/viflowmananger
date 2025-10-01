import { PrismaClient } from '@prisma/client';
import { pbkdf2Sync } from 'crypto';

const prisma = new PrismaClient();

// pbkdf2 hash (no native modules required)
function hashPassword(password: string): string {
  const salt = 'viflow-v1';
  const iterations = 100000;
  const keylen = 64;
  const digest = 'sha512';

  const hash = pbkdf2Sync(password, salt, iterations, keylen, digest);
  return `pbkdf2$${hash.toString('hex')}`;
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123!';

  console.log('🔐 Using pbkdf2 (100k iterations, SHA-512) for password hashing');
  const passwordHash = hashPassword(adminPassword);

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
