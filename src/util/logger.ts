import pino from "pino";
import env from "./env";

// Create a simple logger that works in bundled environments
const logger = pino({
  level: env.LOG_LEVEL || "info"
});

export default logger;
