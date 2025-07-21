import { createInterface } from "readline";
import { loadConfig, saveConfig } from "./config";
import logger from "./logger";
import env from "./env";

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  token_type: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  is_confirmed: boolean;
  is_admin: boolean;
  role: string;
  avatar: string;
  is_suspended: boolean;
  is_deleted: boolean;
  is_onboarded: boolean;
}

export interface AuthClient {
  register(data: RegisterRequest): Promise<User>;
  login(data: LoginRequest): Promise<AuthResponse>;
  getCurrentUser(): Promise<User>;
}

export class ArdenAuthClient implements AuthClient {
  private readonly host: string;
  private readonly timeout: number;

  constructor(host?: string) {
    this.host = (host?.replace(/\/$/, '') || env.HOST) as string;
    this.timeout = 30000;
  }

  async register(data: RegisterRequest): Promise<User> {
    const response = await this.makeRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.makeRequest('/api/sign-in', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<User> {
    const config = await loadConfig();
    if (!config.userToken) {
      throw new Error('Not authenticated. Please run: arden auth login');
    }

    // If we have a stored user ID, use it
    if (config.userId) {
      const response = await this.makeRequest(`/api/user/${config.userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.userToken}`
        }
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return response.json();
    }

    // If no stored user ID, we need to try a different approach
    // Let's make a test call to see what user the token belongs to
    // We'll try accessing a protected endpoint that might give us user info
    throw new Error('User ID not found. Please login again: arden auth login');
  }

  private async makeRequest(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.host}${path}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, requestOptions);
      return response;
    } catch (error) {
      logger.error(`Network error: ${(error as Error).message}`);
      throw new Error(`Network error: ${(error as Error).message}`);
    }
  }

  private async handleError(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData = await response.json();
      
      if (response.status === 422 && errorData.errors) {
        // Validation errors
        const errors = Object.entries(errorData.errors)
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');
        errorMessage = `Validation error: ${errors}`;
      } else if (response.status === 401) {
        errorMessage = 'Incorrect email or password';
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Failed to parse error response
    }

    throw new Error(errorMessage);
  }
}

// Utility functions for collecting user input

export async function promptForEmail(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Email: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptForPassword(label = 'Password'): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    // Simple implementation - just hide the input by disabling echo
    process.stdout.write(`${label}: `);
    process.stdin.setRawMode(true);
    
    let password = '';
    
    const onData = (char: Buffer) => {
      const c = char.toString();
      
      switch (c) {
        case '\u0003': // Ctrl+C
          process.exit(1);
          break;
        case '\r':
        case '\n':
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          console.log(); // New line
          rl.close();
          resolve(password);
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
          break;
        default:
          password += c;
          break;
      }
    };
    
    process.stdin.on('data', onData);
  });
}

export async function promptForName(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Full name: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirmPassword(password: string): Promise<boolean> {
  const confirmation = await promptForPassword('Confirm password');
  return password === confirmation;
}

export async function saveUserToken(token: string, userId?: number): Promise<void> {
  const config = await loadConfig();
  config.userToken = token;
  if (userId) {
    config.userId = userId;
  }
  await saveConfig(config);
}

export async function clearUserToken(): Promise<void> {
  const config = await loadConfig();
  delete config.userToken;
  delete config.userId;
  await saveConfig(config);
}

export async function getUserToken(): Promise<string | undefined> {
  // Check environment variable first
  const envToken = process.env.ARDEN_USER_TOKEN;
  if (envToken) {
    return envToken;
  }

  // Check config file
  const config = await loadConfig();
  return config.userToken;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getUserToken();
  if (!token) return false;

  try {
    const client = new ArdenAuthClient();
    await client.getCurrentUser();
    return true;
  } catch {
    return false;
  }
}
