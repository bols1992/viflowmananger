import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('8080'),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  UPLOAD_DIR: z.string().default('/srv/viflow/uploads'),
  DEPLOY_ROOT: z.string().default('/var/www/viflow'),
  SCRIPTS_DIR: z.string().default('/opt/viflow/ops/scripts'),
  MAX_UPLOAD_SIZE: z.string().transform(Number).default('2147483648'),
  BASIC_AUTH_DEFAULT_USER: z.string().default('viewer'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LETSENCRYPT_EMAIL: z.string().email().default('admin@example.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
};
