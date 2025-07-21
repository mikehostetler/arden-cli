import { Command } from 'commander';
import { buildEvent, validateEvent } from '../../util/schema';
import { sendEvents } from '../../util/client';
import logger from '../../util/logger';
import env from '../../util/env';
import { getUserId, getApiToken } from '../../util/settings';
import { readFileSync } from 'fs';
import { output } from '../../util/output';

interface SendOptions {
  agent?: string;
  user?: string;
  bid?: string;
  mult?: string;
  time?: string;
  data?: string;
  token?: string;
  dryRun?: boolean;
  print?: boolean;
}

export const sendCommand = new Command('send')
  .description('Send a single telemetry event')
  .option('--agent <id>', 'Agent ID (required)')
  .option('--user <ulid>', 'User ULID')
  .option('--bid <int>', 'Bid amount in micro-cents', '0')
  .option('--mult <int>', 'Bid multiplier', '0')
  .option('--time <ms>', 'Timestamp in epoch milliseconds')
  .option('--data <json>', 'Data payload as JSON string, @file, or - for stdin')
  .option('-t, --token <token>', 'Bearer token for authentication')
  .option('--dry-run', 'Validate and print but do not send')
  .option('--print', 'Pretty-print the event payload')
  .allowUnknownOption()
  .action(async (options: SendOptions, command: Command) => {
    try {
      logger.debug(`Command options: ${JSON.stringify(options, null, 2)}`);
      
      // Get global host option from root command
      const globalOptions = command.parent?.parent?.opts() || {};
      const host = globalOptions.host;
      logger.debug(`Global host option: ${host}`);
      
      // Parse remaining arguments as key=value pairs
      const remainingArgs = command.args;
      const keyValueData: Record<string, string | number> = {};
      
      for (const arg of remainingArgs) {
        const [key, ...valueParts] = arg.split('=');
        if (valueParts.length === 0) {
          throw new Error(`Invalid key=value pair: ${arg}`);
        }
        
        const value = valueParts.join('=');
        // Try to parse as number, otherwise keep as string
        const numValue = Number(value);
        keyValueData[key] = !isNaN(numValue) && value !== '' ? numValue : value;
      }

      // Validate required agent
      if (!options.agent) {
        throw new Error('--agent is required');
      }

      // Parse data option
      let dataPayload: any = {};
      if (options.data) {
        if (options.data === '-') {
          // Read from stdin
          const stdinData = readFileSync(0, 'utf8');
          dataPayload = JSON.parse(stdinData);
        } else if (options.data.startsWith('@')) {
          // Read from file
          const filename = options.data.slice(1);
          const fileData = readFileSync(filename, 'utf8');
          dataPayload = JSON.parse(fileData);
        } else {
          // Parse as JSON string
          dataPayload = JSON.parse(options.data);
        }
      }

      // Merge key=value pairs into data
      const finalData = { ...dataPayload, ...keyValueData };

      // Get user ID with fallback priority: CLI option > env var > settings file
      const userId = getUserId(options.user);

      // Build event with defaults
      const event = buildEvent({
        agent: options.agent,
        user: userId,
        time: options.time ? parseInt(options.time) : undefined,
        bid: parseInt(options.bid || '0'),
        mult: parseInt(options.mult || '0'),
        data: finalData
      });

      // Validate event
      const validatedEvent = validateEvent(event);

      // Print if requested
      if (options.print || process.env.LOG_LEVEL === 'debug') {
        output.json(validatedEvent);
      }

      // Exit if dry run
      if (options.dryRun) {
        logger.info('Dry run - event validated successfully');
        return;
      }

      // Send event
      const clientOptions = {
        host: host || env.HOST,
        token: getApiToken(options.token),
      };

      logger.debug(`Sending event with client options: ${JSON.stringify(clientOptions)}`);
      try {
        const response = await sendEvents([validatedEvent], clientOptions);
        logger.debug(`Response: ${JSON.stringify(response)}`);
        
        if (response.status === 'accepted') {
          output.success(`Event sent successfully`);
        } else if (response.status === 'partial') {
        logger.warn(`Event partially processed. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`);
        if (response.rejected) {
          for (const error of response.rejected) {
            logger.error(`Error: ${error.error}`);
          }
        }
      } else {
        logger.error('Event rejected');
        if (response.rejected) {
          for (const error of response.rejected) {
            logger.error(`Error: ${error.error}`);
          }
        }
      }
      } catch (error) {
        logger.error(`Failed to send event: ${error.message}`);
        throw error;
      }

    } catch (error) {
      logger.error(`Failed to send event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
