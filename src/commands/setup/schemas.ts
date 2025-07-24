import { z } from 'zod';

import { GlobalOptions } from '../../util/command-base';
import { OutputFormatSchema } from '../../util/validation';

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

// Init command schema
export const InitOptionsSchema = GlobalOptionsSchema.extend({
  force: z.boolean().optional(),
});

export type InitOptions = z.infer<typeof InitOptionsSchema> & GlobalOptions;
