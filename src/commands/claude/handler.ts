import logger from "../../util/logger";
import { sendTelemetry } from "../../util/client";
import { ClaudeHook } from "./hooks";
import { AgentIds } from "../../agents";
import { output } from "../../util/output";

export interface ClaudeHookOptions {
  dryRun: boolean;
  print: boolean;
  host?: string;
}

export async function handleClaudeHook(
  hook: ClaudeHook,
  opts: ClaudeHookOptions
): Promise<void> {
  try {
    // Read JSON payload from stdin
    const stdinData = await readStdin();
    let payload: unknown;

    try {
      payload = JSON.parse(stdinData);
    } catch (e) {
      logger.error(`Invalid JSON on stdin for hook ${hook}: ${e}`);
      process.exit(2);
    }

    // Enrich the payload with Arden metadata
    const enriched = {
      provider: AgentIds.CLAUDE_CODE,
      hook,
      timestamp: new Date().toISOString(),
      payload,
    };

    // Print enriched payload if requested
    if (opts.print) {
      output.json(enriched);
    }

    // Skip API call in dry-run mode
    if (opts.dryRun) {
      logger.info(`[DRY RUN] Would send telemetry for hook: ${hook}`);
      return;
    }

    // Send telemetry to Arden Stats API
    await sendTelemetry(`claude.${hook}`, enriched, opts.host);
    logger.debug(`Successfully sent telemetry for hook: ${hook}`);
  } catch (error) {
    logger.error(
      `Failed to handle Claude hook ${hook}: ${(error as Error).message}`
    );
    process.exit(1);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}
