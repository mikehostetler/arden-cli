import { createInterface } from 'readline';

import { output } from './output';

/**
 * Prompt user to confirm sending anonymous events
 * Returns true if user confirms, false if they decline
 */
export async function confirmAnonymousEvent(): Promise<boolean> {
  return new Promise(resolve => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    output.info(
      'No user ID is configured. You can send events anonymously or configure a user ID.'
    );
    output.info('To get a user ID, register at: https://ardenstats.com/auth/register');
    output.info('Then configure it with: arden config set user_id <your-user-id>');
    output.info('Or set the ARDEN_USER_ID environment variable.');

    rl.question(
      'Continue sending anonymous event? Press Enter to continue, or Ctrl+C to cancel: ',
      _answer => {
        rl.close();
        resolve(true); // Any response (including empty) confirms
      }
    );

    // Handle Ctrl+C gracefully
    rl.on('SIGINT', () => {
      rl.close();
      output.info('\nOperation cancelled by user.');
      resolve(false);
    });
  });
}

/**
 * Check if user is configured and prompt for anonymous events if not
 * Returns true if should proceed (user configured or confirmed anonymous)
 * Returns false if user declined to send anonymous event
 */
export async function checkUserOrPrompt(userId?: string): Promise<boolean> {
  if (userId) {
    return true; // User is configured, proceed
  }

  return await confirmAnonymousEvent();
}
