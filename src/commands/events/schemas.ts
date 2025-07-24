import { z } from 'zod';

import { GlobalOptions } from '../../util/command-base';
import { AgentIdSchema, FilePathSchema, OutputFormatSchema } from '../../util/validation';

// Base global options schema
const GlobalOptionsSchema = z.object({
  host: z.string().optional(),
  token: z.string().optional(),
  user: z.string().optional(),
  format: OutputFormatSchema.optional(),
  verbose: z.boolean().optional(),
  quiet: z.boolean().optional(),
  yes: z.boolean().optional(),
});

// Event command schema (formerly events send)
export const EventsSendOptionsSchema = GlobalOptionsSchema.extend({
  agent: AgentIdSchema,
  user: z.string().optional(),
  time: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val) : undefined)),
  bid: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val) : 0)),
  mult: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val) : 0)),
  data: z.string().optional(),
  file: FilePathSchema.optional(),

  print: z.boolean().optional(),
}).refine(data => data.data !== undefined || data.file !== undefined, {
  message: 'Either --data or --file must be provided',
  path: ['data'],
});

export type EventsSendOptions = z.infer<typeof EventsSendOptionsSchema> & GlobalOptions;
