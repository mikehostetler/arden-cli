import dotenv from 'dotenv';

dotenv.config();

const env = {
  NODE_ENV: process.env['NODE_ENV'] || 'development',
  ARDEN_API_TOKEN: process.env['ARDEN_API_TOKEN'] || '',
  ARDEN_USER_ID: process.env['ARDEN_USER_ID'] || '',
};

export default env;
