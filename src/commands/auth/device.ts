import chalk from 'chalk';
import open from 'open';
import { Socket } from 'phoenix';
import WebSocket from 'ws';

import { createClient } from '../../util/client';
import { logger, output } from '../../util/logging';
import { reportError } from '../../util/telemetry';

// WebSocket import for explicit transport configuration

interface DeviceAuthResponse {
  short_code: string;
  socket_topic: string;
  socket_url: string;
  expires_in: number;
}

export async function deviceAuthFlow(host: string): Promise<string> {
  try {
    // Step 1: Request device authorization
    output.message(chalk.dim('Initiating device authorization...'));
    const client = (await createClient(host)) as any;
    const response = (await client
      .post('api/device_auth/request', {
        json: { device_name: 'arden-cli' },
      })
      .json()) as DeviceAuthResponse;

    // Step 2: Show user instructions
    showAuthInstructions(response.short_code, host);

    // Auto-open browser on macOS/Windows (but not in CI/non-interactive environments)
    if (process.platform !== 'linux' && process.env['CI'] !== 'true' && process.stdout.isTTY) {
      try {
        const deviceUrl = `${host}/device/${response.short_code}`;
        await open(deviceUrl);
        output.message(chalk.dim('Browser opened automatically'));
      } catch {
        // Ignore browser opening errors - user can still open manually
      }
    }

    // Step 3: Connect to WebSocket and wait for authorization
    output.message(chalk.dim('Waiting for authorization...'));
    const ulid = await waitForAuthorization(response.socket_topic, response.socket_url);

    output.message(chalk.green('✓ Authorization successful'));
    return ulid;
  } catch (error) {
    throw new Error(`Device authorization failed: ${(error as Error).message}`);
  }
}

function showAuthInstructions(code: string, host: string) {
  output.message('');
  output.message(chalk.bold('Authentication Required'));
  output.message('');
  output.message(`${chalk.cyan('Visit'.padEnd(17))} ${host}/device`);
  output.message(`${chalk.cyan('Enter code'.padEnd(17))} ${chalk.bold(code)}`);
  output.message('');
}

async function waitForAuthorization(topic: string, socketUrl: string): Promise<string> {
  const deviceCode = topic.split(':')[1]; // Extract device code from topic
  const host = socketUrl.replace(/^wss?:\/\//, '').replace(/\/socket$/, '');

  // Try WebSocket first, with polling fallback
  return Promise.race([
    waitForAuthorizationWebSocket(topic, socketUrl),
    waitForAuthorizationPolling(deviceCode || '', host),
  ]);
}

async function waitForAuthorizationWebSocket(topic: string, socketUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    logger.debug(`Starting WebSocket connection to ${socketUrl}`);
    logger.debug(`Topic: ${topic}`);
    let socket: Socket;

    try {
      socket = new Socket(socketUrl, {
        // Explicitly provide WebSocket implementation for Node.js
        transport: WebSocket as any,
      });
      logger.debug('Socket created successfully');
    } catch (error) {
      const errorMessage = `Failed to create WebSocket connection: ${(error as Error).message}`;
      logger.error(errorMessage);
      reportError(error as Error, 'websocket_creation_failed');
      // Don't exit - let polling fallback handle it
      reject(new Error(errorMessage));
      return;
    }

    let connected = false;

    // Set up connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!connected) {
        logger.debug('WebSocket connection timeout reached');
        socket.disconnect();
        reject(new Error('WebSocket failed to connect within 30 seconds'));
      }
    }, 30000);

    // Set up authorization timeout (8 minutes for WebSocket, leaving 2 for polling)
    const authTimeout = setTimeout(() => {
      logger.debug('WebSocket authorization timeout reached');
      socket.disconnect();
      reject(new Error('WebSocket authorization timed out'));
    }, 480000);

    socket.onOpen(() => {
      logger.debug('WebSocket connection opened');
      connected = true;
      clearTimeout(connectionTimeout);
    });

    socket.onError(error => {
      logger.error(`WebSocket error: ${JSON.stringify(error)}`);
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      socket.disconnect();
      const errorMessage = `WebSocket connection error: ${error}`;
      reportError(new Error(errorMessage), 'websocket_connection_error');
      reject(new Error(errorMessage));
    });

    socket.onClose(event => {
      logger.debug(`WebSocket closed: ${event.reason || 'Unknown reason'}, code: ${event.code}`);
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      if (!connected) {
        const errorMessage = `WebSocket connection closed: ${event.reason || 'Unknown reason'}`;
        reject(new Error(errorMessage));
      }
    });

    // Connect to socket
    try {
      logger.debug('Attempting to connect socket...');
      socket.connect();
    } catch (error) {
      const errorMessage = `Failed to connect to WebSocket: ${(error as Error).message}`;
      logger.error(errorMessage);
      reportError(error as Error, 'websocket_connect_failed');
      reject(new Error(errorMessage));
      return;
    }

    // Join the device auth channel
    logger.debug(`Joining channel: ${topic}`);
    const channel = socket.channel(topic);

    channel.on('authorized', payload => {
      logger.debug(`Received 'authorized' event with payload: ${JSON.stringify(payload)}`);
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      socket.disconnect();

      if (payload && payload.user_ulid) {
        logger.debug(`Successfully authorized with user_ulid: ${payload.user_ulid}`);
        resolve(payload.user_ulid);
      } else {
        logger.error('Invalid authorization response - missing user_ulid');
        reject(new Error('Invalid authorization response'));
      }
    });

    channel
      .join()
      .receive('ok', response => {
        logger.debug(`Channel join successful: ${JSON.stringify(response)}`);
        output.message(chalk.dim('Connected to server, waiting for browser authorization...'));
      })
      .receive('error', error => {
        logger.error(`Channel join failed: ${JSON.stringify(error)}`);
        clearTimeout(connectionTimeout);
        clearTimeout(authTimeout);
        socket.disconnect();
        reject(new Error(`Failed to join channel: ${error.reason || 'Unknown error'}`));
      });
  });
}

async function waitForAuthorizationPolling(deviceCode: string, host: string): Promise<string> {
  logger.debug(`Starting polling fallback for device code: ${deviceCode}`);

  const pollInterval = 2000; // Poll every 2 seconds
  const maxPolls = 300; // 10 minutes max (300 * 2 seconds = 600 seconds)
  let pollCount = 0;

  const protocol = host.includes('localhost') ? 'http' : 'https';

  return new Promise((resolve, reject) => {
    const poll = async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        reject(new Error('Polling authorization timed out after 10 minutes'));
        return;
      }

      try {
        logger.debug(`Polling attempt ${pollCount}/${maxPolls} for device code: ${deviceCode}`);

        const client = await createClient(`${protocol}://${host}`);
        const response = await client
          .get(`api/device_auth/check/${deviceCode}`)
          .json<{ status: string; user_ulid?: string }>();

        if (response.status === 'authorized' && response.user_ulid) {
          logger.debug(`Polling successful: authorized with user_ulid: ${response.user_ulid}`);
          resolve(response.user_ulid);
          return;
        } else if (response.status === 'pending') {
          // Continue polling
          setTimeout(poll, pollInterval);
        } else if (response.status === 'expired') {
          reject(new Error('Device authorization code has expired'));
          return;
        } else {
          // Continue polling for other statuses
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        logger.debug(`Polling attempt ${pollCount} failed: ${(error as Error).message}`);

        // If it's the first few attempts, continue polling (might be network issues)
        if (pollCount < 5) {
          setTimeout(poll, pollInterval);
        } else {
          // After several failed attempts, only continue if we haven't hit the limit
          if (pollCount < maxPolls) {
            setTimeout(poll, pollInterval * 2); // Slower polling after failures
          } else {
            reject(new Error('Polling failed: unable to check authorization status'));
          }
        }
      }
    };

    // Start polling after a short delay to let WebSocket try first
    setTimeout(poll, 5000);
  });
}
