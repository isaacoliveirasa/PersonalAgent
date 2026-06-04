import Module from 'module';
const realRequire = Module.prototype.require;
Module.prototype.require = function (this: any, id: string) {
  if (id === 'lodash-es') {
    return realRequire.call(this, 'lodash');
  }
  return realRequire.apply(this, arguments as any);
} as any;

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { InMemoryRunner } from '@google/adk';
import { validateSecretToken, isAllowedUser } from '../src/security';
import { sendTelegramMessage, getTelegramFileUrl, downloadTelegramFile } from '../src/telegram';
import type { TelegramUpdate } from '../src/telegram';
import { orchestratorAgent } from '../src/agents/orchestrator';
import { config } from '../src/config';
import { getMemoryFacts } from '../src/memory';

// Global runner declaration to persist memory session state across consecutive webhook executions
const runner = new InMemoryRunner({
  appName: 'personal-agent',
  agent: orchestratorAgent
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests from Telegram
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Webhook Secret Token Validation (X-Telegram-Bot-Api-Secret-Token)
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (!validateSecretToken(secretToken)) {
    console.warn(`[Security] Invalid or missing webhook secret token detected.`);
    return res.status(403).json({ error: 'Unauthorized: Invalid Secret Token' });
  }

  try {
    const update = req.body as TelegramUpdate;
    const message = update.message;

    if (!message) {
      // Ignore updates that do not contain a message (e.g., button callbacks, etc.)
      return res.status(200).json({ status: 'ok', detail: 'no_message_in_update' });
    }

    const userId = message.from?.id;
    const chatId = message.chat.id;

    // 2. User Validation (Telegram ID)
    if (userId === undefined || !isAllowedUser(userId)) {
      console.warn(`[Security] Message rejected from unauthorized user (ID: ${userId}).`);
      // Return 200 OK so Telegram doesn't retry sending this message
      return res.status(200).json({ status: 'ignored', reason: 'unauthorized_user' });
    }

    const incomingText = message.text?.trim();
    const voice = message.voice;

    if (!incomingText && !voice) {
      return res.status(200).json({ status: 'ok', detail: 'no_supported_content' });
    }

    // Load user memory bank facts
    const memoryFacts = await getMemoryFacts(userId.toString());
    const memoryFactsString = Object.entries(memoryFacts)
      .map(([key, val]) => `- ${key}: ${val}`)
      .join('\n') || '- None';

    // Retrieve user timezone or fallback to America/Toronto
    const userTimezone = memoryFacts['timezone'] || 'America/Toronto';

    // Format current date and time in the user's localized timezone
    const now = new Date();
    const currentDateTimeString = now.toLocaleString('en-US', {
      timeZone: userTimezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Structure dynamic System Context to inject date/time and persistent facts
    const systemContext = `[System Context]
- Current Local Time: ${currentDateTimeString} (Timezone: ${userTimezone})
- Saved Memory Facts:
${memoryFactsString}`;

    // Construct prompt parts for ADK
    const parts: any[] = [{ text: systemContext }];

    if (incomingText) {
      parts.push({ text: `[User Prompt]\n${incomingText}` });
      console.info(`[Success] Routing message text to Orchestrator: "${incomingText}"`);
    }

    if (voice) {
      console.info(`[Voice] Downloading voice message with file_id: ${voice.file_id}`);
      try {
        const filePath = await getTelegramFileUrl(voice.file_id);
        const fileBuffer = await downloadTelegramFile(filePath);
        const base64Audio = fileBuffer.toString('base64');
        const mimeType = voice.mime_type || 'audio/ogg';

        parts.push({
          inlineData: {
            data: base64Audio,
            mimeType: mimeType
          }
        });
        parts.push({ text: `[User sent a voice message above. Transcribe, understand, and answer it in English. Address the user using the saved honorific and name if available.]` });
        console.info(`[Voice] Successfully attached voice data. Mime: ${mimeType}`);
      } catch (err) {
         console.error('[Voice] Error retrieving/processing voice file from Telegram:', err);
         await sendTelegramMessage(chatId, "Sir, I encountered an issue downloading your voice message. Could you please try again or send a text message?");
         return res.status(200).json({ status: 'ok', detail: 'voice_download_error' });
      }
    }

    // Ensure GEMINI_API_KEY is bound for the runner session
    process.env.GEMINI_API_KEY = config.geminiApiKey;

    let replyText = '';

    // Consume the async generator event loop from runEphemeral
    const responseGenerator = runner.runEphemeral({
      userId: userId.toString(),
      newMessage: {
        role: 'user',
        parts: parts
      }
    });

    for await (const event of responseGenerator) {
      if (event.content && event.content.parts) {
        // Retrieve and merge all text parts that are not thoughts (internal reasoning)
        const mergedText = event.content.parts
          .filter((part: any) => !part.thought)
          .map((part: any) => part.text)
          .filter((text: string) => text)
          .join('\n');
        if (mergedText) {
          replyText += mergedText;
        }
      }
    }

    if (!replyText) {
      replyText = "My apologies, sir. I was unable to compile a response.";
    }

    console.info(`[Success] Orchestrator execution completed.`);
    
    await sendTelegramMessage(chatId, replyText);

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
