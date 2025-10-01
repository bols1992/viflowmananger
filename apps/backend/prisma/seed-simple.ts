import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Simple hash for initial seeding only - NOT for production!
// This is just to get the system running, then change password via proper hashing
function simpleHash(password: string): string {
  // SHA-256 with salt - not as secure as bcrypt/argon2 but works without native modules
  const salt = 'viflow-initial-salt-change-password-after';
  return createHash('sha256').update(salt + password).digest('hex');
}

async function main() {
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123!';

  console.warn('⚠️  WARNING: Using simple SHA-256 hashing for initial setup');
  console.warn('⚠️  IMPORTANT: Change admin password after first login!');

  const passwordHash = simpleHash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user created/updated: ${admin.username}`);
  console.log(`⚠️  CRITICAL: This password uses simple hashing. Change it immediately after login!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
