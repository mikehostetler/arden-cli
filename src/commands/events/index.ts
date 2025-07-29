import { readFileSync } from 'fs';

import { sendEvents } from '../../util/client';
import { createCommand, createCommandAction, getResolvedConfig } from '../../util/command-base';
import { logger, output } from '../../util/logging';
import { buildEvent, validateEvent } from '../../util/schema';
import { checkUserOrPrompt } from '../../util/user-prompt';
import { JsonDataSchema, validateInput } from '../../util/validation';
import { EventsSendOptions, EventsSendOptionsSchema } from './schemas';

export const eventCommand = createCommand('event', 'Send a telemetry event to Arden Stats API')
  .option('--agent <id>', 'Agent ID (required)')
  .option('--bid <int>', 'Bid amount in micro-cents', '0')
  .option('--mult <int>', 'Bid multiplier', '0')
  .option('--time <ms>', 'Timestamp in epoch milliseconds')
  .option('--data <json>', 'Data payload as JSON string, @file, or - for stdin')
  .option('--file <path>', 'Read data from file')
  .option('--print', 'Pretty-print the event payload')
  .allowUnknownOption()
  .action(createCommandAction(runEvent, EventsSendOptionsSchema));

async function runEvent(options: EventsSendOptions, config: ReturnType<typeof getResolvedConfig>) {
  logger.debug(`Command options: ${JSON.stringify(options, null, 2)}`);
  logger.debug(`Global host option: ${config.host}`);

  // Parse remaining arguments as key=value pairs
  // Note: This will need special handling since we can't easily access command.args in the wrapper
  // For now, we'll implement basic functionality without extra args
  const keyValueData: Record<string, string | number> = {};

  // TODO: Add support for key=value args if needed - this would require modifying the wrapper
  // or adding a special pattern for handling remaining args

  // Parse data payload with validation (agent is validated by schema)
  let dataPayload: Record<string, string | number> = {};

  if (options.data) {
    if (options.data === '-') {
      // Read from stdin
      const stdinData = readFileSync(0, 'utf8');
      const parsedData = JSON.parse(stdinData);
      dataPayload = validateInput(JsonDataSchema, parsedData, 'stdin data');
    } else if (options.data.startsWith('@')) {
      // Read from file
      const filename = options.data.slice(1);
      const fileData = readFileSync(filename, 'utf8');
      const parsedData = JSON.parse(fileData);
      dataPayload = validateInput(JsonDataSchema, parsedData, 'file data');
    } else {
      // Parse as JSON string
      const parsedData = JSON.parse(options.data);
      dataPayload = validateInput(JsonDataSchema, parsedData, 'data argument');
    }
  } else if (options.file) {
    // Read from file specified with --file
    const fileData = readFileSync(options.file, 'utf8');
    const parsedData = JSON.parse(fileData);
    dataPayload = validateInput(JsonDataSchema, parsedData, 'file data');
  }

  // Merge key=value pairs into data
  const finalData = { ...dataPayload, ...keyValueData };

  // Get user ID from resolved config
  const userId = config.userId;

  // Check if user wants to proceed with anonymous event if no user ID
  const shouldProceed = await checkUserOrPrompt(userId);
  if (!shouldProceed) {
    output.info('Event sending cancelled.');
    return;
  }

  // Build event with defaults
  const event = buildEvent({
    agent: options.agent,
    user: userId,
    time: options.time,
    bid: options.bid || 0,
    mult: options.mult || 0,
    data: finalData,
  });

  // Validate event
  const validatedEvent = validateEvent(event);

  // Print if requested
  if (options.print || process.env['LOG_LEVEL'] === 'debug') {
    output.json(validatedEvent);
  }

  // Send event
  const clientOptions = {
    host: config.host,
    token: config.token,
  };

  logger.debug(`Sending event with client options: ${JSON.stringify(clientOptions)}`);

  const response = await sendEvents([validatedEvent], clientOptions);
  logger.debug(`Response: ${JSON.stringify(response)}`);

  if (response.status === 'accepted') {
    output.success(`Event sent successfully`);
  } else if (response.status === 'partial') {
    logger.warn(
      `Event partially processed. Accepted: ${response.accepted_count}, Rejected: ${response.rejected_count}`
    );
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
}
