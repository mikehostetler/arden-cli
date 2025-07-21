import { Command } from "commander";
import { validateEvents } from "../../util/schema";
import { sendEvents } from "../../util/client";
import logger from "../../util/logger";
import env from "../../util/env";
import { readFileSync } from "fs";
import { output } from "../../util/output";

interface PipeOptions {
  token?: string;
  dryRun?: boolean;
  print?: boolean;
}

export const pipeCommand = new Command("pipe")
  .description("Send telemetry events from stdin (JSON object or array)")
  .option("-t, --token <token>", "Bearer token for authentication")
  .option("--dry-run", "Validate and print but do not send")
  .option("--print", "Pretty-print the event payloads")
  .action(async (options: PipeOptions, command: Command) => {
    try {
      // Read from stdin
      const stdinData = readFileSync(0, "utf8");

      if (!stdinData.trim()) {
        throw new Error("No data received from stdin");
      }

      // Parse JSON
      const jsonData = JSON.parse(stdinData);

      // Normalize to array
      const events = Array.isArray(jsonData) ? jsonData : [jsonData];

      logger.info(`Processing ${events.length} events from stdin`);

      // Validate events
      const validatedEvents = validateEvents(events);

      // Print if requested
      if (options.print || process.env["LOG_LEVEL"] === "debug") {
        output.json(validatedEvents);
      }

      // Exit if dry run
      if (options.dryRun) {
        logger.info(
          `Dry run - ${validatedEvents.length} events validated successfully`
        );
        return;
      }

      // Get global host option from root command
      const globalOptions = command.parent?.parent?.opts() || {};
      const host = globalOptions.host;
      
      // Send events
      const clientOptions = {
        host: host || env.HOST,
        token: options.token || process.env["ARDEN_API_TOKEN"],
      };

      const response = await sendEvents(validatedEvents, clientOptions);

      if (response.status === "accepted") {
        logger.info(`All ${response.accepted_count} events sent successfully`);
      } else if (response.status === "partial") {
        logger.warn(
          `Partial success. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`
        );
        if (response.rejected) {
          for (const error of response.rejected) {
            logger.error(`Event ${error.index}: ${error.error}`);
          }
        }
      } else {
        logger.error(`All events rejected. Count: ${response.rejected_count}`);
        if (response.rejected) {
          for (const error of response.rejected) {
            logger.error(`Event ${error.index}: ${error.error}`);
          }
        }
      }

      // Log event IDs if available
      if (response.event_ids && response.event_ids.length > 0) {
        logger.info(`Event IDs: ${response.event_ids.join(", ")}`);
      }
    } catch (error) {
      logger.error(
        `Failed to process piped events: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      process.exit(1);
    }
  });
