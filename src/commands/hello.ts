import { Command } from 'commander';
import logger from '../util/logger';
import env from '../util/env';

export const helloCommand = new Command('hello')
  .description('Say hello from Arden CLI')
  .option('-n, --name <name>', 'Name to greet', 'World')
  .action((options) => {
    logger.info(`Hello, ${options.name}! 🌟`);
    logger.info('Welcome to Arden CLI!');
    
    if (env.LOG_LEVEL === 'debug') {
      logger.debug('Debug mode is enabled');
      logger.debug(`Environment: ${env.NODE_ENV}`);
      logger.debug(`API URL: ${env.ARDEN_API_URL}`);
    }
  });
