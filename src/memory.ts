import { kv } from '@vercel/kv';
export { kv };

/**
 * Retrieves all saved facts from the Vercel KV database for the specified user.
 */
export async function getMemoryFacts(userId: string): Promise<Record<string, string>> {
  try {
    const memoryKey = `user:${userId}:memory`;
    const data = await kv.hgetall<Record<string, string>>(memoryKey);
    return data || {};
  } catch (error) {
    console.error(`[Vercel KV] Error reading memory for user ${userId}:`, error);
    return {};
  }
}

/**
 * Saves or updates a fact key-value pair inside Vercel KV for the specified user.
 */
export async function saveMemoryFact(userId: string, key: string, value: string): Promise<void> {
  try {
    const memoryKey = `user:${userId}:memory`;
    await kv.hset(memoryKey, { [key]: value });
    console.info(`[Vercel KV] Fact saved for user ${userId}: "${key}" = "${value}"`);
  } catch (error) {
    console.error(`[Vercel KV] Error writing memory for user ${userId}:`, error);
  }
}
