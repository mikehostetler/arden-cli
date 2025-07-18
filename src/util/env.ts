import dotenv from "dotenv";

dotenv.config();

const env = {
  LOG_LEVEL: process.env["LOG_LEVEL"] || "info",
  NODE_ENV: process.env["NODE_ENV"] || "development",
  ARDEN_API_TOKEN: process.env["ARDEN_API_TOKEN"] || "",
  ARDEN_USER_ID: process.env["ARDEN_USER_ID"] || "",
  HOST: process.env["HOST"] || "https://ardenstats.com",
};

// Cannot use logging here because it will cause a circular dependency
if (env.LOG_LEVEL === "debug") {
  console.log("Current environment variables:");
  console.log(`  LOG_LEVEL: ${env.LOG_LEVEL}`);
  console.log(`  NODE_ENV: ${env.NODE_ENV}`);
  console.log(
    `  ARDEN_API_TOKEN: ${env.ARDEN_API_TOKEN ? "[SET]" : "[NOT SET]"}`
  );
  console.log(
    `  ARDEN_USER_ID: ${env.ARDEN_USER_ID ? "[SET]" : "[NOT SET]"}`
  );
  console.log(`  HOST: ${env.HOST}`);
}

export default env;
