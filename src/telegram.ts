import https from 'https';
import { config } from './config';

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramVoice {
  file_id: string;
  unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  voice?: TelegramVoice;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

/**
 * Sends a text message back to the Telegram chat.
 * Uses native Node.js https module to avoid heavy cold starts on Vercel
 * and prevent fetch-related libuv assertion crashes on Windows.
 */
export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  
  const payload = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
  });

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            console.error(`Failed to send message to Telegram: Status ${res.statusCode} - ${responseData}`);
            resolve(false);
          }
        });
      }
    );

    req.on('error', (error) => {
      console.error('Network error sending message to Telegram:', error);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

/**
  * Obtains the file_path of a Telegram file using its file_id.
  */
export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getFile?file_id=${fileId}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            const body = JSON.parse(data);
            if (body.ok && body.result?.file_path) {
              resolve(body.result.file_path);
            } else {
              reject(new Error(`Telegram getFile returned not OK: ${data}`));
            }
          } else {
            reject(new Error(`Telegram getFile failed with status ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
  * Downloads a binary file from Telegram servers.
  */
export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Telegram download failed with status ${res.statusCode}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}


