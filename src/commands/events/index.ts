import { Command } from 'commander';
import { sendCommand } from './send';
import { batchCommand } from './batch';
import { pipeCommand } from './pipe';
import { validateCommand } from './validate';

export const eventsCommand = new Command('events')
  .description('Send telemetry events to Arden Stats API')
  .addCommand(sendCommand)
  .addCommand(batchCommand)
  .addCommand(pipeCommand)
  .addCommand(validateCommand);
