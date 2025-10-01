/**
 * Password hashing utility with fallback from argon2 to bcrypt
 * Argon2 is preferred but requires native compilation
 * Bcrypt is fallback for easier deployment
 */

let useArgon2 = true;
let argon2: typeof import('argon2') | null = null;
let bcrypt: typeof import('bcrypt') | null = null;

// Try to load argon2, fallback to bcrypt
try {
  argon2 = await import('argon2');
} catch (error) {
  console.warn('⚠️  argon2 not available, falling back to bcrypt');
  useArgon2 = false;
  try {
    bcrypt = await import('bcrypt');
  } catch (bcryptError) {
    throw new Error('Neither argon2 nor bcrypt is available. Please install one of them.');
  }
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  if (useArgon2 && argon2) {
    return argon2.hash(password);
  } else if (bcrypt) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
  throw new Error('No password hashing library available');
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (useArgon2 && argon2) {
    try {
      return await argon2.verify(hash, password);
    } catch {
      // Hash might be bcrypt, try bcrypt
      if (bcrypt) {
        return bcrypt.compare(password, hash);
      }
      throw new Error('Failed to verify password');
    }
  } else if (bcrypt) {
    return bcrypt.compare(password, hash);
  }
  throw new Error('No password hashing library available');
}

/**
 * Get the name of the active hashing algorithm
 */
export function getHashingAlgorithm(): string {
  return useArgon2 ? 'argon2' : 'bcrypt';
}
