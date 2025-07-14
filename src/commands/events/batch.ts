import { Command } from 'commander';
import { validateEvents } from '../../util/schema';
import { sendEvents } from '../../util/client';
import logger from '../../util/logger';
import env from '../../util/env';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';

interface BatchOptions {
  file: string;
  chunk?: string;
  token?: string;
  host?: string;
  dryRun?: boolean;
  print?: boolean;
}

export const batchCommand = new Command('batch')
  .description('Send multiple telemetry events from a JSON file')
  .requiredOption('--file <path>', 'JSON file containing events (supports .gz)')
  .option('--chunk <size>', 'Chunk size for batching', '50')
  .option('-t, --token <token>', 'Bearer token for authentication')
  .option('-H, --host <url>', 'API host URL')
  .option('--dry-run', 'Validate and print but do not send')
  .option('--print', 'Pretty-print the event payloads')
  .action(async (options: BatchOptions) => {
    try {
      // Read file
      let fileData: Buffer | string;
      if (options.file.endsWith('.gz')) {
        const compressed = readFileSync(options.file);
        fileData = gunzipSync(compressed).toString('utf8');
      } else {
        fileData = readFileSync(options.file, 'utf8');
      }

      // Parse JSON
      const jsonData = JSON.parse(fileData);
      
      // Normalize to array
      const events = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      logger.info(`Processing ${events.length} events from ${options.file}`);

      // Validate events
      const validatedEvents = validateEvents(events);
      
      // Print if requested
      if (options.print || process.env.LOG_LEVEL === 'debug') {
        console.log(JSON.stringify(validatedEvents, null, 2));
      }

      // Exit if dry run
      if (options.dryRun) {
        logger.info(`Dry run - ${validatedEvents.length} events validated successfully`);
        return;
      }

      // Send events
      const clientOptions = {
        host: options.host || env.HOST,
        token: options.token || process.env.ARDEN_API_TOKEN,
      };

      const response = await sendEvents(validatedEvents, clientOptions);
      
      if (response.status === 'accepted') {
        logger.info(`All ${response.accepted_count} events sent successfully`);
      } else if (response.status === 'partial') {
        logger.warn(`Partial success. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`);
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
        logger.info(`Event IDs: ${response.event_ids.join(', ')}`);
      }

    } catch (error) {
      logger.error(`Failed to process batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
