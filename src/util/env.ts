import { z, parseEnv } from "znv";
import dotenv from "dotenv";

dotenv.config();

const env = parseEnv(process.env, {
  LOG_LEVEL: z.string().optional().default("info"),
  NODE_ENV: z.string().optional().default("development"),
  ARDEN_API_URL: z.string().url().optional().default("https://api.arden.dev"),
  ARDEN_API_TOKEN: z.string().optional().default(""),
});

// Cannot use logging here because it will cause a circular dependency
if (env.LOG_LEVEL === "debug") {
  console.log("Current environment variables:");
  console.log(`  LOG_LEVEL: ${env.LOG_LEVEL}`);
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(`  ARDEN_API_URL: ${env.ARDEN_API_URL}`);
  console.log(`  ARDEN_API_TOKEN: ${env.ARDEN_API_TOKEN ? '[SET]' : '[NOT SET]'}`);
}

export default env;
