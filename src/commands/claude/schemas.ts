import { z } from 'zod';

import { GlobalOptions } from '../../util/command-base';
import { FilePathSchema, OutputFormatSchema } from '../../util/validation';

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

// Claude init command schema
export const ClaudeInitOptionsSchema = GlobalOptionsSchema.extend({
  file: FilePathSchema.optional(),
  host: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export type ClaudeInitOptions = z.infer<typeof ClaudeInitOptionsSchema> & GlobalOptions;

// Claude import command schema
export const ClaudeImportOptionsSchema = GlobalOptionsSchema.extend({
  file: FilePathSchema.optional(),
  agent: z
    .string()
    .regex(/^[A-Z0-9-]+$/i, 'Agent ID must contain only letters, numbers, and hyphens')
    .min(1, 'Agent ID cannot be empty')
    .max(64, 'Agent ID cannot exceed 64 characters')
    .optional(),
});

export type ClaudeImportOptions = z.infer<typeof ClaudeImportOptionsSchema> & GlobalOptions;

// Claude hook command schema (internal command)
export const ClaudeHookOptionsSchema = GlobalOptionsSchema.extend({
  hook: z.enum(['pre-commit', 'post-commit', 'pre-push'], {
    errorMap: () => ({ message: 'Hook must be one of: pre-commit, post-commit, pre-push' }),
  }),
  agent: z
    .string()
    .regex(/^[A-Z0-9-]+$/i, 'Agent ID must contain only letters, numbers, and hyphens')
    .min(1, 'Agent ID cannot be empty')
    .max(64, 'Agent ID cannot exceed 64 characters'),
});

export type ClaudeHookOptions = z.infer<typeof ClaudeHookOptionsSchema> & GlobalOptions;
