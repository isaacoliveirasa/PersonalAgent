import { config } from './config';

/**
 * Validates if the X-Telegram-Bot-Api-Secret-Token header sent by Telegram
 * matches the token configured in the environment.
 */
export function validateSecretToken(headerToken: string | string[] | undefined): boolean {
  if (!headerToken) {
    return false;
  }
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  return token === config.telegramSecretToken;
}

/**
 * Validates if the Telegram user ID is in the allowed list (Allowed User ID).
 */
export function isAllowedUser(userId: number): boolean {
  return userId === config.telegramAllowedUserId;
}
