import Appsignal from '@appsignal/javascript';

import { logger } from './logging';
import { isTelemetryEnabled } from './settings';

let appsignal: Appsignal | null = null;

/**
 * Initialize AppSignal telemetry if enabled
 */
export function initTelemetry(): void {
  if (!isTelemetryEnabled()) {
    logger.debug('Telemetry disabled, skipping AppSignal initialization');
    return;
  }

  try {
    // Use the provided key from the documentation
    appsignal = new Appsignal({
      key: process.env['APPSIGNAL_PUSH_API_KEY'] || 'ea96ea5c-5ac1-4e64-b00d-c36f1b9c41b8',
    });

    logger.debug('AppSignal telemetry initialized');
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
      if (context) {
        const tags: Record<string, string> = {};
        Object.entries(context).forEach(([key, value]) => {
          tags[key] = String(value);
        });
        span.setTags(tags);
      }
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
