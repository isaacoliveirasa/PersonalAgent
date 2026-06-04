import { kv } from './memory.js';
import { getGoogleOAuthClient, listUpcomingEvents, listTodayEmails } from './google.js';
import { sendTelegramMessage } from './telegram.js';
import { orchestratorAgent } from './agents/orchestrator.js';
import { InMemoryRunner } from '@google/adk';
import dotenv from 'dotenv';

dotenv.config();

async function testAll() {
  console.log('=== STARTING INTEGRATION TESTS ===\n');

  // 1. Verify Vercel KV Database connection
  console.log('1. Testing Vercel KV Database Connection...');
  try {
    const testUserId = 'test_user_id_1234';
    const testKey = 'test_name';
    const testVal = `TestUser-${Date.now()}`;
    await kv.hset(`user:${testUserId}:memory`, { [testKey]: testVal });
    const fetched = await kv.hgetall<Record<string, string>>(`user:${testUserId}:memory`);
    if (fetched && fetched[testKey] === testVal) {
      console.log(`   ✅ DB Write and Read OK! Stored: "${testVal}", Fetched: "${fetched[testKey]}"`);
    } else {
      throw new Error(`DB values mismatch! Stored "${testVal}" but retrieved "${fetched?.[testKey]}"`);
    }
  } catch (err) {
    console.error('   ❌ DB Test Failed:', err);
  }

  console.log('\n2. Testing Google OAuth2 Client and Calendar API...');
  try {
    const oauth = getGoogleOAuthClient();
    const tokenInfo = await oauth.getTokenInfo(oauth.credentials.refresh_token || '');
    console.log('   ✅ Google OAuth token is VALID! Scopes authorized:', tokenInfo.scopes);
    
    console.log('   Testing calendar list...');
    const calResult = await listUpcomingEvents(1, 'America/Toronto');
    console.log(`   ✅ Calendar retrieved: ${calResult.slice(0, 100).replace(/\n/g, ' ')}...`);
  } catch (err: any) {
    console.error('   ❌ Google Calendar/OAuth Test Failed:', err.message || err);
  }

  console.log('\n3. Testing Gmail API Access...');
  try {
    const gmailResult = await listTodayEmails('America/Toronto');
    console.log(`   ✅ Gmail list retrieved: ${gmailResult.slice(0, 100).replace(/\n/g, ' ')}...`);
  } catch (err: any) {
    console.error('   ❌ Gmail API Test Failed:', err.message || err);
  }

  console.log('\n4. Testing Gemini Agent Orchestration with Multimodal Audio Context simulation...');
  try {
    process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
    const runner = new InMemoryRunner({
      appName: 'test-agent-suite',
      agent: orchestratorAgent
    });

    // Simulate an incoming user audio/voice request
    const mockAudioBase64 = 'UklGRigAAABXQVZFZm10IBIAAAABAAERKgAAKlgAAAEAAgA='; // small mock wav header block
    const parts = [
      { text: '[System Context]\n- Current Local Time: Thursday, June 04, 2026 10:00\n- Saved Memory Facts:\n- user_name: TestUser\n- honorific: Sir\n- timezone: America/Toronto' },
      {
        inlineData: {
          data: mockAudioBase64,
          mimeType: 'audio/wav'
        }
      },
      { text: '[User sent a voice message above. Transcribe, understand, and answer it in English. Address the user using the saved honorific and name if available.]' }
    ];

    console.log('   Sending mock audio message to agent runner...');
    const responseGenerator = runner.runEphemeral({
      userId: 'test_user_id_1234',
      newMessage: {
        role: 'user',
        parts: parts
      }
    });

    let agentResponse = '';
    for await (const event of responseGenerator) {
      if (event.content?.parts) {
        const text = event.content.parts
          .filter((p: any) => !p.thought)
          .map((p: any) => p.text)
          .join('\n');
        if (text) agentResponse += text;
      }
    }
    console.log(`   ✅ Agent Response OK! length: ${agentResponse.length} chars.`);
    console.log(`   Response Preview: "${agentResponse.replace(/\n/g, ' ').slice(0, 120)}..."`);
  } catch (err: any) {
    console.error('   ❌ Agent/Multimodal Audio Test Failed:', err.message || err);
  }

  console.log('\n=== INTEGRATION TESTS COMPLETED ===');
}

testAll().catch(console.error);
