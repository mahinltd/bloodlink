import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  APP_ENV: z.enum(['demo', 'staging', 'production']).default('demo'),
  APP_DOMAIN: z.string().min(1),
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  CORS_ORIGINS: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ADMIN_JWT_SECRET: z.string().min(32),
  MAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  MAIL_FROM: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  SUPPORT_EMAIL: z.string().email(),
  STORAGE_DRIVER: z.enum(['stub', 'cloudinary']).default('stub'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  PUSH_DRIVER: z.enum(['console', 'fcm']).default('console'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_WEB_CLIENT_ID: z.string().optional(),
  CALL_DRIVER: z.enum(['stub', 'agora']).default('stub'),
  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),
  JOB_SECRET: z.string().min(32),
  FIRST_SUPERADMIN_EMAIL: z.string().email(),
  FIRST_SUPERADMIN_PASSWORD: z.string().min(12),
  RELEASE_ALLOWED_HOSTS: z.string().default(''),
  SEED_DEMO: booleanFromEnv,
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function assertDriverRequirements(env: Env): void {
  const requiredByDriver: Record<string, Array<keyof Env>> = {
    resend: ['RESEND_API_KEY'],
    cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    fcm: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
    agora: ['AGORA_APP_ID', 'AGORA_APP_CERTIFICATE'],
  };

  for (const selectedDriver of [
    env.MAIL_DRIVER,
    env.STORAGE_DRIVER,
    env.PUSH_DRIVER,
    env.CALL_DRIVER,
  ]) {
    const keys = requiredByDriver[selectedDriver];
    if (!keys) continue;

    for (const key of keys) {
      if (!env[key]) {
        throw new Error(`${key} is required when ${selectedDriver} is selected.`);
      }
    }
  }
}

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${issues}`);
}

assertDriverRequirements(parsed.data);

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
