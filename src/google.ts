import { google } from 'googleapis';
import { config } from './config.js';

export function getGoogleOAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret
  );

  oauth2Client.setCredentials({
    refresh_token: config.googleRefreshToken,
  });

  return oauth2Client;
}

/**
 * Lists the upcoming events on the user's primary calendar.
 */
export async function listUpcomingEvents(limit: number = 5, timezone: string = 'America/Toronto'): Promise<string> {
  const auth = getGoogleOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: limit,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events || events.length === 0) {
      return '📅 No upcoming events found.';
    }

    let responseText = '📅 *Your Upcoming Events:*\n\n';
    events.forEach((event) => {
      const start = event.start?.dateTime || event.start?.date || '';
      const formattedDate = start 
        ? new Date(start).toLocaleString('en-US', { timeZone: timezone, hour12: false }) 
        : 'All day';
      
      responseText += `• *${event.summary || 'Untitled Event'}*\n  Start: ${formattedDate}\n\n`;
    });

    return responseText;
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    return '❌ Error fetching upcoming calendar events. Please check your credentials.';
  }
}

/**
 * Lists the user's Gmail messages received today.
 */
export async function listTodayEmails(timezone: string = 'America/Toronto'): Promise<string> {
  const auth = getGoogleOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // Calculate beginning of today in the given timezone
    const now = new Date();
    // Use formatter to get date components of today in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(now);
    const query = `after:${year}/${month}/${day}`;

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 15,
    });

    const messages = response.data.messages;
    if (!messages || messages.length === 0) {
      return `📩 No emails received today (${year}/${month}/${day}) in timezone ${timezone}.`;
    }

    let responseText = `📩 *Your Today's Emails (${year}/${month}/${day}):*\n\n`;

    for (const msg of messages) {
      if (!msg.id) continue;
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const from = headers.find((h) => h.name === 'From')?.value || 'Unknown Sender';
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(No Subject)';
      const snippet = detail.data.snippet || '';

      responseText += `• *From:* ${from}\n  *Subject:* ${subject}\n  *Snippet:* ${snippet}\n\n`;
    }

    return responseText;
  } catch (error) {
    console.error('Error fetching Gmail messages:', error);
    return '❌ Error fetching today\'s emails. Please check your Google API access scopes (specifically gmail.readonly).';
  }
}

/**
 * Creates a draft email in the user's Gmail account.
 */
export async function createGmailDraft(to: string, subject: string, body: string): Promise<string> {
  const auth = getGoogleOAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // Construct standard RFC 2822 message format
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage,
        },
      },
    });

    return `📝 Draft successfully created! Draft ID: ${response.data.id}. To: ${to}, Subject: "${subject}".`;
  } catch (error) {
    console.error('Error creating Gmail draft:', error);
    return '❌ Error creating email draft. Please verify your Google API access scopes (specifically gmail.compose or gmail.modify).';
  }
}

