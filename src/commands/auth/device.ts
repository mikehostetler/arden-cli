import open from 'open';
import { Socket } from 'phoenix';
import WebSocket from 'ws';

import { createClient } from '../../util/client';
import { output } from '../../util/logging';
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
    output.info('Initiating device authorization...');
    const client = await createClient(host);
    const response = await client
      .post('api/device_auth/request', {
        json: { device_name: 'arden-cli' },
      })
      .json<DeviceAuthResponse>();

    // Step 2: Show user instructions
    showAuthInstructions(response.short_code, host);

    // Auto-open browser on macOS/Windows (but not in CI/non-interactive environments)
    if (process.platform !== 'linux' && process.env.CI !== 'true' && process.stdout.isTTY) {
      try {
        const deviceUrl = `${host}/device/${response.short_code}`;
        await open(deviceUrl);
        output.info('Browser opened automatically');
      } catch {
        // Ignore browser opening errors - user can still open manually
      }
    }

    // Step 3: Connect to WebSocket and wait for authorization
    output.info('Waiting for authorization...');
    const ulid = await waitForAuthorization(response.socket_topic, response.socket_url);

    output.success('Authorization successful!');
    return ulid;
  } catch (error) {
    throw new Error(`Device authorization failed: ${(error as Error).message}`);
  }
}

function showAuthInstructions(code: string, host: string) {
  output.message('');
  output.message('┌──────────────────────────────────────────┐');
  output.message(`│  1) Open ${host}/device   │`);
  output.message(`│  2) Enter this code:  ${code}          │`);
  output.message('└──────────────────────────────────────────┘');
  output.message('');
}

async function waitForAuthorization(topic: string, socketUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let socket: Socket;

    try {
      socket = new Socket(socketUrl, {
        // Explicitly provide WebSocket implementation for Node.js
        transport: WebSocket as any,
      });
    } catch (error) {
      const errorMessage = `Failed to create WebSocket connection: ${(error as Error).message}`;
      reportError(error as Error, 'websocket_creation_failed');
      output.error(errorMessage);
      process.exit(1);
    }

    let connected = false;

    // Set up connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!connected) {
        socket.disconnect();
        reject(new Error('Failed to connect to server within 30 seconds'));
      }
    }, 30000);

    // Set up authorization timeout (10 minutes)
    const authTimeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Authorization timed out after 10 minutes'));
    }, 600000);

    socket.onOpen(() => {
      connected = true;
      clearTimeout(connectionTimeout);
    });

    socket.onError(error => {
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      socket.disconnect();
      const errorMessage = `WebSocket connection error: ${error}`;
      reportError(new Error(errorMessage), 'websocket_connection_error');
      output.error(errorMessage);
      process.exit(1);
    });

    socket.onClose(event => {
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      if (!connected) {
        const errorMessage = `WebSocket connection closed: ${event.reason || 'Unknown reason'}`;
        reportError(new Error(errorMessage), 'websocket_connection_closed');
        output.error(errorMessage);
        process.exit(1);
      }
    });

    // Connect to socket
    try {
      socket.connect();
    } catch (error) {
      const errorMessage = `Failed to connect to WebSocket: ${(error as Error).message}`;
      reportError(error as Error, 'websocket_connect_failed');
      output.error(errorMessage);
      process.exit(1);
    }

    // Join the device auth channel
    const channel = socket.channel(topic);

    channel.on('authorized', payload => {
      clearTimeout(connectionTimeout);
      clearTimeout(authTimeout);
      socket.disconnect();

      if (payload && payload.user_ulid) {
        resolve(payload.user_ulid);
      } else {
        reject(new Error('Invalid authorization response'));
      }
    });

    channel
      .join()
      .receive('ok', () => {
        output.info('Connected to server, waiting for browser authorization...');
      })
      .receive('error', error => {
        clearTimeout(connectionTimeout);
        clearTimeout(authTimeout);
        socket.disconnect();
        reject(new Error(`Failed to join channel: ${error.reason || 'Unknown error'}`));
      });
  });
}
