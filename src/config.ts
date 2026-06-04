import dotenv from 'dotenv';

// Load environment variables from .env file in local development environment
dotenv.config();

export interface Config {
  telegramBotToken: string;
  telegramSecretToken: string;
  telegramAllowedUserId: number;
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  geminiApiKey: string;
  geminiModel: string;
  kvRestApiUrl: string;
  kvRestApiToken: string;
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvNumberOrThrow(name: string): number {
  const value = getEnvOrThrow(name);
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number.`);
  }
  return parsed;
}

export const config: Config = {
  telegramBotToken: getEnvOrThrow('TELEGRAM_BOT_TOKEN'),
  telegramSecretToken: getEnvOrThrow('TELEGRAM_SECRET_TOKEN'),
  telegramAllowedUserId: getEnvNumberOrThrow('TELEGRAM_ALLOWED_USER_ID'),
  googleClientId: getEnvOrThrow('GOOGLE_CLIENT_ID'),
  googleClientSecret: getEnvOrThrow('GOOGLE_CLIENT_SECRET'),
  googleRefreshToken: getEnvOrThrow('GOOGLE_REFRESH_TOKEN'),
  geminiApiKey: getEnvOrThrow('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  kvRestApiUrl: getEnvOrThrow('KV_REST_API_URL'),
  kvRestApiToken: getEnvOrThrow('KV_REST_API_TOKEN'),
};
