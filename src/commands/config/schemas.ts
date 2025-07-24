import { z } from 'zod';

import { GlobalOptions } from '../../util/command-base';

// Base global options schema
const GlobalOptionsSchema = z.object({
  host: z.string().optional(),
  token: z.string().optional(),
  user: z.string().optional(),
  format: z.enum(['json', 'table', 'yaml']).optional(),
  verbose: z.boolean().optional(),
  quiet: z.boolean().optional(),
  yes: z.boolean().optional(),
});

// Config command schema - simplified to only accept global options
export const ConfigOptionsSchema = GlobalOptionsSchema;

export type ConfigOptions = z.infer<typeof ConfigOptionsSchema> & GlobalOptions;
