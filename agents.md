# 🤖 Agent Architecture (ADK v2.0)

This document outlines the architecture, cognitive decision-making flow, and technical specifications of the intelligent agents comprising the Personal Assistant ecosystem, leveraging the **Google Agent Development Kit (ADK)** deployed on Vercel's Serverless infrastructure.

---

## 🧭 1. Architectural Overview

The system implements the **Orchestrator-Workers (Router + Specialized Agents)** pattern. Instead of relying on a single, massive system prompt to handle all intents, the ADK acts as a central session coordinator that delegates subtasks to modular sub-agents.

### Request Execution Flow
1. **Ingress (Webhook):** Telegram forwards the incoming event after verifying the sender's Telegram ID.
2. **Central Orchestrator:** Analyzes the natural language intent and determines which tools or sub-agents must be invoked.
3. **Execution Loop (ADK Runner):** The ADK manages iterative tool calls (*Function Calling*), consolidates execution payloads, and maintains the contextual conversation memory.
4. **Egress (Response):** The final execution state is formatted into a natural language response and dispatched back to the user.

---

## 🧠 2. Agent Definitions

### 2.1. Central Orchestrator (Router Agent)
The primary cognitive entry point of the ecosystem. Its sole responsibility is parsing user input, understanding the global context, and routing the execution flow to the correct specialist or firing global control tools.

* **Persona:** A highly efficient, analytical, secure, and direct executive assistant.
* **Core Instructions (System Prompt):**
    * You manage the user's digital workspace and residential smart home automation.
    * Never guess data state regarding Google Workspace or home telemetry without calling the appropriate `Tool`.
    * If the task requires interaction with Gmail or Google Calendar, immediately delegate to the `GoogleWorkspaceAgent`.
    * If the task requires structural, climate, or lighting commands, delegate to the `SmartHomeAgent`.
    * Always validate explicit intent parameters before triggering any destructive mutations (e.g., deleting events or emails).

### 2.2. Google Workspace Agent (Sub-Agent)
A specialized worker agent fine-tuned exclusively for interacting with the Google Workspace API ecosystem.

* **Persona:** A highly organized digital secretary focused on productivity and information retrieval.
* **Capabilities (Mapped Tools):**
    * `google_calendar_list_events`: Lists and filters upcoming appointments on the primary calendar.
    * `google_calendar_create_event`: Inserts new time blocks, meetings, or reminders.
    * `google_gmail_search`: Query and filter emails by sender, subject, or urgency tags.
    * `google_gmail_summarize`: Processes and synthesizes long, multi-turn email threads.

### 2.3. Smart Home Agent (Sub-Agent)
A specialized worker agent focused on IoT execution and physical environment telemetry.

* **Persona:** The operational core of the smart home. Prioritizes low-latency execution and real-world state confirmations.
* **Capabilities (Mapped Tools):**
    * `home_device_control`: Mutates the state of smart switches, lights, and smart plugs via REST APIs/Webhooks.
    * `home_climate_set`: Changes room temperature targets based on contextual or explicit triggers.
    * `home_status_query`: Returns real-time sensor metrics regarding security states and energy consumption.

---

## 🛠️ 3. Implementation Blueprint using the ADK SDK

Within the ADK framework, agents and capabilities are declared via strongly-typed TypeScript objects. Below is the structural specification for initializing our engine:

### Sample Agent Configuration

```typescript
import { Agent, Tool } from '@google/adk';

// 1. Tool Declaration adhering to ADK schema specifications
const listCalendarTool = new Tool({
  name: 'list_calendar',
  description: 'Lists upcoming appointments from the user\'s primary Google Calendar for the current day.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of events to return' }
    }
  },
  execute: async ({ limit }) => {
    // Native integration with googleapis runtime
    return await fetchGoogleCalendarEvents(limit || 5);
  }
});

// 2. Agent Initialization powered by Next-Gen Gemini Models
const workspaceAgent = new Agent({
  name: 'GoogleWorkspaceAgent',
  model: 'gemini-1.5-pro', // Or your enterprise tier recommended model
  instructions: 'You are a specialist agent handling Google Workspace data. Utilize your available tools to read, query, and modify emails and calendars.',
  tools: [listCalendarTool]
});

export { workspaceAgent };
```

---

## 🔒 4. Security Layer & Context Isolation

Adhering to the ADK security framework guidelines, all components operate under the Principle of Least Privilege:

* **Token Isolation:** The ADK runtime executing on Vercel abstracts raw OAuth2 tokens away from the LLM prompt context layer. The model simply decides which function to invoke; the underlying TypeScript layer safely binds credentials during execution (`execute`).
* **Scope Hardening:** The associated Google Cloud Service Account/App explicitly requests tightly-scoped permissions (`https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/gmail.modify`), preventing accidental data loss or broader scope exploitation.
* **Session Binding:** Conversational history arrays are strictly indexed against verified Telegram `chat_id` keys managed by the ADK Session Provider, eliminating cross-tenant or unauthenticated state leakage.

---

## 💡 5. Google ADK Design Best Practices

To ensure maximum efficiency and correct delegation, all agents and tools must adhere to the following course best practices:

* **Always Provide a Clear `description`:** For multi-agent systems, the orchestrator delegates tasks to sub-agents via tools (`AgentTool`). The orchestrator relies entirely on the sub-agent's `description` property to understand its capabilities and determine when to call it.
* **Keep `instruction` Specific and Role-Focused:** Avoid vague directives (like "be a helpful assistant"). Always explicitly define:
  1. **Role/Persona** (e.g., *"You are a professional executive assistant"*).
  2. **Task Scope** (e.g., *"Help the user query upcoming calendar appointments"*).
  3. **Tone/Personality Constraints** (e.g., *"Direct, executive, and formal tone"*).
* **Use Zod for Tool Parameters:** Define tool parameters using `zod` schemas instead of plain JSON objects. This guarantees TypeScript type safety and runtime validation for arguments before tool execution.
* **Wrap Sub-Agents using `AgentTool`:** To delegate tasks from the main orchestrator to specialized sub-agents, wrap the sub-agent instance inside an `AgentTool` object before adding it to the orchestrator's `tools` array.
* **Use `InMemoryRunner` for Serverless Hooks:** For stateless serverless webhook executions, utilize `InMemoryRunner` to safely isolate memory, sessions, and artifacts per request.

