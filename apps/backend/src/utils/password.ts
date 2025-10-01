/**
 * Password hashing utility with fallback chain:
 * argon2 > bcrypt > pbkdf2 (crypto)
 *
 * Native modules (argon2, bcrypt) require compilation
 * pbkdf2 is built-in fallback for initial deployment
 */

import { pbkdf2Sync, timingSafeEqual } from 'crypto';

let useArgon2 = false;
let useBcrypt = false;
let argon2: typeof import('argon2') | null = null;
let bcrypt: typeof import('bcrypt') | null = null;

// Try to load argon2, then bcrypt, fallback to crypto
try {
  argon2 = await import('argon2');
  useArgon2 = true;
  console.log('✅ Using argon2 for password hashing');
} catch {
  try {
    bcrypt = await import('bcrypt');
    useBcrypt = true;
    console.log('✅ Using bcrypt for password hashing');
  } catch {
    console.warn('⚠️  Native modules unavailable, using pbkdf2 (crypto)');
    console.warn('⚠️  Install bcrypt or argon2 for production: pnpm rebuild');
  }
}

/**
 * Hash a password with pbkdf2 (fallback)
 */
function pbkdf2Hash(password: string): string {
  const salt = 'viflow-v1'; // In production, use random salt per user
  const iterations = 100000;
  const keylen = 64;
  const digest = 'sha512';

  const hash = pbkdf2Sync(password, salt, iterations, keylen, digest);
  return `pbkdf2$${hash.toString('hex')}`;
}

/**
 * Verify pbkdf2 hash
 */
function pbkdf2Verify(hash: string, password: string): boolean {
  if (!hash.startsWith('pbkdf2$')) return false;

  const expectedHash = hash.substring(7);
  const computedHash = pbkdf2Hash(password).substring(7);

  // Timing-safe comparison
  if (expectedHash.length !== computedHash.length) return false;

  return timingSafeEqual(
    Buffer.from(expectedHash, 'hex'),
    Buffer.from(computedHash, 'hex')
  );
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  if (useArgon2 && argon2) {
    return argon2.hash(password);
  }

  if (useBcrypt && bcrypt) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Fallback to pbkdf2
  return pbkdf2Hash(password);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  // Try pbkdf2 first (our fallback format)
  if (hash.startsWith('pbkdf2$')) {
    return pbkdf2Verify(hash, password);
  }

  // Try argon2
  if (useArgon2 && argon2) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Continue to bcrypt
    }
  }

  // Try bcrypt
  if (useBcrypt && bcrypt) {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      // Hash format not recognized
    }
  }

  // Try pbkdf2 even if hash doesn't have prefix (legacy)
  try {
    return pbkdf2Verify('pbkdf2$' + hash, password);
  } catch {
    return false;
  }
}

/**
 * Get the name of the active hashing algorithm
 */
export function getHashingAlgorithm(): string {
  if (useArgon2) return 'argon2';
  if (useBcrypt) return 'bcrypt';
  return 'pbkdf2 (crypto fallback)';
}
