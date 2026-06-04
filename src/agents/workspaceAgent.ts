import { Agent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { listUpcomingEvents, listTodayEmails, createGmailDraft } from '../google.js';

// Define the tool parameters using Zod
const listCalendarParameters = z.object({
  limit: z.number().optional().describe('Maximum number of events to return'),
  timezone: z.string().optional().describe('The timezone to format event times (e.g. America/Toronto)')
});

// Define the tool for Google Calendar listing using FunctionTool
export const listCalendarTool = new FunctionTool({
  name: 'list_calendar',
  description: 'Lists upcoming appointments from the user\'s primary Google Calendar.',
  parameters: listCalendarParameters,
  execute: async ({ limit, timezone }: { limit?: number; timezone?: string }) => {
    return await listUpcomingEvents(limit || 5, timezone || 'America/Toronto');
  }
});

export const listTodayEmailsTool = new FunctionTool({
  name: 'list_today_emails',
  description: 'Retrieves and lists the user\'s emails received today to summarize or read.',
  parameters: z.object({
    timezone: z.string().optional().describe('The user timezone to calculate the start of the day (e.g. America/Toronto)')
  }),
  execute: async ({ timezone }: { timezone?: string }) => {
    return await listTodayEmails(timezone || 'America/Toronto');
  }
});

export const createDraftTool = new FunctionTool({
  name: 'create_gmail_draft',
  description: 'Creates a draft email response in the user\'s Gmail account.',
  parameters: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email plain text body content')
  }),
  execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
    return await createGmailDraft(to, subject, body);
  }
});

import { config } from '../config.js';

// Initialize the Google Workspace Agent
export const workspaceAgent = new Agent({
  name: 'GoogleWorkspaceAgent',
  model: config.geminiModel,
  description: 'Specialized workspace agent that retrieves and formats upcoming appointments, queries today\'s emails, and drafts new email responses.',
  instruction: 'You are a specialist agent handling Google Workspace data. Utilize your tools to read calendar events, retrieve today\'s emails, and create draft emails.',
  tools: [listCalendarTool, listTodayEmailsTool, createDraftTool]
});

