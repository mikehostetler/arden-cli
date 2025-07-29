import Appsignal from '@appsignal/javascript';

import { logger } from './logging';
import { isTelemetryEnabled } from './settings';

let appsignal: Appsignal | null = null;

// Version and commit SHA are injected at build time by tsup
declare const __VERSION__: string;
declare const __COMMIT_SHA__: string;

function getVersion(): string {
  return typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'unknown';
}

function getCommitSha(): string {
  return typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'unknown';
}

/**
 * Initialize AppSignal telemetry if enabled
 */
export function initTelemetry(): void {
  if (!isTelemetryEnabled()) {
    logger.debug('Telemetry disabled, skipping AppSignal initialization');
    return;
  }

  try {
    // Use the front-end key for telemetry with revision tracking
    appsignal = new Appsignal({
      key: process.env['APPSIGNAL_PUSH_API_KEY'] || 'b88357c3-4524-44e7-aae4-75d67e1b8cf1',
      revision: getCommitSha(),
    });

    logger.debug(
      'AppSignal telemetry initialized with version:',
      getVersion(),
      'commit:',
      getCommitSha()
    );
  } catch (error) {
    logger.debug(`Failed to initialize AppSignal: ${(error as Error).message}`);
  }
}

/**
 * Report an error to AppSignal if telemetry is enabled
 */
export function reportError(error: Error, context?: Record<string, unknown>): void {
  if (!appsignal || !isTelemetryEnabled()) {
    return;
  }

  try {
    appsignal.sendError(error, span => {
      // Always include version and basic context
      const tags: Record<string, string> = {
        version: getVersion(),
        environment: process.env['NODE_ENV'] || 'development',
        platform: process.platform,
        nodeVersion: process.version,
      };

      // Add any additional context provided
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          tags[key] = String(value);
        });
      }

      span.setTags(tags);
    });
  } catch (telemetryError) {
    logger.debug(`Failed to report error to AppSignal: ${(telemetryError as Error).message}`);
  }
}

/**
 * Stop AppSignal and clean up
 */
export function stopTelemetry(): void {
  if (appsignal) {
    try {
      // JavaScript version doesn't have an explicit stop method
      appsignal = null;
      logger.debug('AppSignal telemetry stopped');
    } catch (error) {
      logger.debug(`Failed to stop AppSignal: ${(error as Error).message}`);
    }
  }
}
