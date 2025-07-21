import pino from "pino";
import env from "./env";

// Create a logger with pretty formatting in development
const logger = pino({
  level: env.LOG_LEVEL || "info",
  transport: env.NODE_ENV === "development" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss",
      ignore: "pid,hostname"
    }
  } : undefined,
});

export default logger;
