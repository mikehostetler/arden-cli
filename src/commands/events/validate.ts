import { Command } from 'commander';
import { validateEvents } from '../../util/schema';
import logger from '../../util/logger';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';

interface ValidateOptions {
  file?: string;
  print?: boolean;
}

export const validateCommand = new Command('validate')
  .description('Validate telemetry events without sending them')
  .option('--file <path>', 'JSON file to validate (supports .gz), or - for stdin')
  .option('--print', 'Pretty-print the validated events')
  .action(async (options: ValidateOptions) => {
    try {
      let jsonData: any;

      if (options.file) {
        if (options.file === '-') {
          // Read from stdin
          const stdinData = readFileSync(0, 'utf8');
          if (!stdinData.trim()) {
            throw new Error('No data received from stdin');
          }
          jsonData = JSON.parse(stdinData);
        } else {
          // Read from file
          let fileData: Buffer | string;
          if (options.file.endsWith('.gz')) {
            const compressed = readFileSync(options.file);
            fileData = gunzipSync(compressed).toString('utf8');
          } else {
            fileData = readFileSync(options.file, 'utf8');
          }
          jsonData = JSON.parse(fileData);
        }
      } else {
        // Read from stdin by default
        const stdinData = readFileSync(0, 'utf8');
        if (!stdinData.trim()) {
          throw new Error('No data provided. Use --file <path> or pipe JSON to stdin');
        }
        jsonData = JSON.parse(stdinData);
      }

      // Normalize to array
      const events = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      logger.info(`Validating ${events.length} events...`);

      // Validate events
      const validatedEvents = validateEvents(events);
      
      // Print if requested
      if (options.print) {
        console.log(JSON.stringify(validatedEvents, null, 2));
      }

      logger.info(`✓ All ${validatedEvents.length} events are valid`);
      
      // Summary
      const summary = validatedEvents.reduce((acc, event) => {
        acc.agents.add(event.agent);
        if (event.user) acc.users.add(event.user);
        acc.totalBid += event.bid;
        return acc;
      }, { agents: new Set(), users: new Set(), totalBid: 0 });

      logger.info(`Summary: ${summary.agents.size} agents, ${summary.users.size} users, ${summary.totalBid} total bid`);

    } catch (error) {
      logger.error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
