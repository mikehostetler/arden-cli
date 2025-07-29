// Claude Code agent ID constant
import { sendTelemetry } from '../../util/client';
import { output } from '../../util/logging';
import { getCurrentDateISO } from '../../util/time';
import { ClaudeHook } from './hooks';

const CLAUDE_CODE_AGENT_ID = 'A-CLAUDECODE';

export interface ClaudeHookOptions {
  dryRun: boolean;
  print: boolean;
  host?: string;
}

export async function handleClaudeHook(hook: ClaudeHook, opts: ClaudeHookOptions): Promise<void> {
  try {
    // Read JSON payload from stdin
    const stdinData = await readStdin();

    let payload: unknown;

    try {
      payload = JSON.parse(stdinData);
    } catch {
      // Invalid JSON - exit with code 2 for blocking error
      process.stderr.write(`Invalid JSON received for hook ${hook}\n`);
      process.exit(2);
    }

    // Remove sensitive data from payload
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload.cwd;
    delete sanitizedPayload.transcript_path;

    // Enrich the payload with Arden metadata
    const enriched = {
      provider: CLAUDE_CODE_AGENT_ID,
      hook,
      timestamp: getCurrentDateISO(),
      payload: sanitizedPayload,
    };

    // Print enriched payload if requested (for debugging only)
    if (opts.print) {
      output.json(enriched);
      return;
    }

    // Skip API call in dry-run mode
    if (opts.dryRun) {
      process.stderr.write(`[DRY RUN] Would send telemetry for hook: ${hook}\n`);
      return;
    }

    // Send telemetry to Arden Stats API silently
    await sendTelemetry(`claude.${hook}`, enriched, opts.host, true);

    // Success - exit with code 0, no stdout output
    process.exit(0);
  } catch (error) {
    // Non-blocking error - output to stderr and exit with non-zero code
    process.stderr.write(`Failed to handle Claude hook ${hook}: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let hasData = false;

    // Check if stdin is a TTY (interactive terminal)
    if (process.stdin.isTTY) {
      reject(
        new Error(
          'This command is meant to be called by Claude Code with JSON data via stdin, not interactively.'
        )
      );
      return;
    }

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', chunk => {
      hasData = true;
      data += chunk;
    });

    process.stdin.on('end', () => {
      if (!hasData || data.trim() === '') {
        reject(
          new Error('No data received from stdin. This command expects JSON data from Claude Code.')
        );
        return;
      }
      resolve(data);
    });

    process.stdin.on('error', error => {
      reject(error);
    });
  });
}
