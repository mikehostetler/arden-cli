import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Zod schema for environment variable validation
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ARDEN_API_TOKEN: z.string().optional(),
  ARDEN_USER_ID: z.string().optional(),
  ARDEN_HOST: z.string().url().optional(),
  ARDEN_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  ARDEN_DEFAULT_FORMAT: z.enum(['json', 'table', 'yaml']).optional(),
  ARDEN_INTERACTIVE: z.string().optional(),

  // Legacy environment variables (with deprecation support)
  HOST: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
});

const rawEnv = {
  NODE_ENV: process.env['NODE_ENV'],
  ARDEN_API_TOKEN: process.env['ARDEN_API_TOKEN'],
  ARDEN_USER_ID: process.env['ARDEN_USER_ID'],
  ARDEN_HOST: process.env['ARDEN_HOST'],
  ARDEN_LOG_LEVEL: process.env['ARDEN_LOG_LEVEL'],
  ARDEN_DEFAULT_FORMAT: process.env['ARDEN_DEFAULT_FORMAT'],
  ARDEN_INTERACTIVE: process.env['ARDEN_INTERACTIVE'],
  HOST: process.env['HOST'],
  LOG_LEVEL: process.env['LOG_LEVEL'],
};

// Validate and parse environment variables
const envResult = EnvSchema.safeParse(rawEnv);

if (!envResult.success) {
  // eslint-disable-next-line no-console
  console.warn(`Invalid environment variables: ${envResult.error.message}`);
}

const env = envResult.success ? envResult.data : EnvSchema.parse({});

// Track which deprecation warnings have been shown to avoid spam
const shownWarnings = new Set<string>();

function showDeprecationWarning(message: string): void {
  if (!shownWarnings.has(message)) {
    // eslint-disable-next-line no-console
    console.warn(message);
    shownWarnings.add(message);
  }
}

// Helper functions for environment variable access with deprecation warnings
export function getEnvApiToken(): string | undefined {
  return env.ARDEN_API_TOKEN;
}

export function getEnvUserId(): string | undefined {
  return env.ARDEN_USER_ID;
}

export function getEnvHost(): string | undefined {
  // Handle legacy HOST with deprecation warning
  if (env.HOST && !env.ARDEN_HOST) {
    showDeprecationWarning(
      'DEPRECATION WARNING: HOST environment variable is deprecated. Use ARDEN_HOST instead.'
    );
    return env.HOST;
  }
  return env.ARDEN_HOST;
}

export function getEnvLogLevel(): string | undefined {
  // Handle legacy LOG_LEVEL with deprecation warning
  if (env.LOG_LEVEL && !env.ARDEN_LOG_LEVEL) {
    showDeprecationWarning(
      'DEPRECATION WARNING: LOG_LEVEL environment variable is deprecated. Use ARDEN_LOG_LEVEL instead.'
    );
    return env.LOG_LEVEL;
  }
  return env.ARDEN_LOG_LEVEL;
}

export function getEnvDefaultFormat(): string | undefined {
  return env.ARDEN_DEFAULT_FORMAT;
}

export function getEnvInteractive(): boolean | undefined {
  return env.ARDEN_INTERACTIVE === 'true'
    ? true
    : env.ARDEN_INTERACTIVE === 'false'
      ? false
      : undefined;
}

export default env;
