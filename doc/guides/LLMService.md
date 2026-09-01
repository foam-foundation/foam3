# FOAM3 LLM Service

## Table of Contents
1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Core Data Models](#core-data-models)
5. [Provider Implementations](#provider-implementations)
6. [Decorator Stack](#decorator-stack)
7. [Reflow Integration](#reflow-integration)
8. [The Agent Loop](#the-agent-loop)
9. [System Prompt](#system-prompt)
10. [Command Registry](#command-registry)
11. [Proposal UI](#proposal-ui)
12. [Configuration](#configuration)
13. [Gotchas](#gotchas)

---

## Quick Start

The LLM service is registered as `llmService` in `foam3/src/foam/core/ai/services.jrl`. Import it wherever needed:

```javascript
imports: ['llmService'],
// ...
var response = await this.llmService.complete(x,
  foam.core.ai.CompletionRequest.create({
    prompt: 'Summarize this data',
    options: foam.core.ai.LLMOptions.create({ temperature: 0.5 })
  })
);
console.log(response.content);
```

Set the API key in `deployment.cfg`:

```
foam.core.ai.ClaudeLLMService.apiKey = sk-ant-api03-xxxxx
```

---

## Overview

### What It Does

The LLM subsystem provides a **provider-agnostic interface** for calling language models (Claude, OpenAI, DeepSeek, Ollama) from both server-side Java and client-side JavaScript. It integrates directly into FOAM's Reflow document engine, where the LLM acts as "just another user" — issuing Reflow commands instead of returning raw markdown.

### Key Files

| File | Purpose |
|------|---------|
| `foam/core/ai/LLMService.js` | Interface, data models, enums |
| `foam/core/ai/ClaudeLLMService.js` | Anthropic Claude provider (Java) |
| `foam/core/ai/OpenAILLMService.js` | OpenAI provider (Java) |
| `foam/core/ai/DeepSeekLLMService.js` | DeepSeek provider (extends OpenAI) |
| `foam/core/ai/OllamaLLMService.js` | Local Ollama provider (extends OpenAI) |
| `foam/core/ai/LoggingLLMService.js` | Request/response logging decorator |
| `foam/core/ai/PMLLMService.js` | Performance monitoring decorator |
| `foam/core/ai/ConversationalLLMService.js` | Chat history decorator (JS) |
| `foam/core/ai/services.jrl` | CSpec service registration |
| `foam/core/reflow/ai/AgentCommand.js` | LLM-powered Reflow command generator |
| `foam/core/reflow/ai/LLMCommand.js` | Direct LLM markdown query |
| `foam/core/reflow/ai/AskCommand.js` | LLM self-query loop |
| `foam/core/reflow/ai/Propose.js` | Human review UI for proposals |
| `foam/core/reflow/ai/cmds.jrl` | Reflow command registrations |
| `foam/core/reflow/ai/flows.jrl` | System prompt (stored as a flow) |

---

## Architecture

### Full System View

```
+=========================================================================+
|                          FOAM3 LLM SYSTEM                               |
|                                                                         |
|  +---------------------------+     +----------------------------------+ |
|  |      REFLOW CONSOLE       |     |        SERVICE STACK             | |
|  |                           |     |                                  | |
|  |  User types:              |     |  +----------------------------+  | |
|  |  ? show overdue invoices  |     |  |    ClientLLMService        |  | |
|  |                           |     |  |    (browser-side proxy)    |  | |
|  |  +---------------------+  |     |  +-------------+--------------+  | |
|  |  |   AgentCommand      |--+---->|                |                 | |
|  |  | (or LLMCommand)     |  |     |       HTTP / SessionBox         | |
|  |  +---------------------+  |     |                |                 | |
|  |           |               |     |  +-------------v--------------+  | |
|  |           v               |     |  |  LLMServiceSkeleton        |  | |
|  |  +---------------------+  |     |  |  (server-side entry)       |  | |
|  |  | Parse response into |  |     |  +-------------+--------------+  | |
|  |  | Reflow commands     |  |     |                |                 | |
|  |  +---------------------+  |     |  +-------------v--------------+  | |
|  |           |               |     |  |  LoggingLLMService         |  | |
|  |           v               |     |  |  (logs model, tokens, ms)  |  | |
|  |  +---------------------+  |     |  +-------------+--------------+  | |
|  |  | Execute commands    |  |     |                |                 | |
|  |  | in flow document    |  |     |  +-------------v--------------+  | |
|  |  +---------------------+  |     |  |  PMLLMService              |  | |
|  |                           |     |  |  (performance metrics)     |  | |
|  +---------------------------+     |  +-------------+--------------+  | |
|                                    |                |                 | |
|                                    |  +-------------v--------------+  | |
|                                    |  |  ClaudeLLMService          |  | |
|                                    |  |  (Anthropic Messages API)  |  | |
|                                    |  +----------------------------+  | |
|                                    +----------------------------------+ |
+=========================================================================+
```

### Client-Server Boundary

```
  BROWSER (JavaScript)                    SERVER (Java)
 +-------------------------+         +----------------------------+
 |                         |         |                            |
 |  AgentCommand           |         |  LLMServiceSkeleton        |
 |       |                 |         |       |                    |
 |       v                 |         |       v                    |
 |  ClientLLMService ------+-- HTTP -+-> LoggingLLMService        |
 |  (proxy)                |         |       |                    |
 |                         |   /service/     v                    |
 |                         |  llmService  PMLLMService            |
 |                         |         |       |                    |
 |                         |         |       v                    |
 |                         |         |  ClaudeLLMService          |
 |                         |         |       |                    |
 |                         |         |       v                    |
 |                         |         |  api.anthropic.com         |
 +-------------------------+         +----------------------------+

  API keys NEVER cross this boundary. All provider
  authentication happens server-side only.
```

---

## Core Data Models

All models live in `foam/core/ai/LLMService.js`.

### ChatRole Enum

| Value | Label | Usage |
|-------|-------|-------|
| `SYSTEM` | `system` | System prompt instructions |
| `USER` | `user` | Human or agent input |
| `ASSISTANT` | `assistant` | LLM response |

### Data Flow Through Models

```
+-------------------+        +-------------------+        +---------------------+
|  CompletionRequest |       |    LLMOptions      |       |  CompletionResponse  |
|                   |        |                   |        |                     |
|  prompt  ---------+------->|  model            |        |  content            |
|  options  --------+--+     |  maxTokens (4096) |        |  model              |
+-------------------+  |     |  temperature (1.0)|        |  inputTokens        |
                       +---->|  systemPrompt     |        |  outputTokens       |
                             +-------------------+        |  stopReason         |
                                                          +---------------------+
```

### ChatMessage

Used for multi-turn conversations:

```javascript
foam.core.ai.ChatMessage.create({
  role:    foam.core.ai.ChatRole.USER,
  content: 'What DAOs are available?'
})
```

### LLMService Interface

Two methods define the entire contract:

| Method | Purpose | Signature |
|--------|---------|-----------|
| `complete` | Single prompt | `complete(Context x, CompletionRequest request)` returns `CompletionResponse` |
| `chat` | Multi-turn | `chat(Context x, ChatMessage[] messages, LLMOptions options)` returns `CompletionResponse` |

The interface declaration sets `skeleton: true`, `client: true`, `proxy: true` — FOAM auto-generates:
- `LLMServiceSkeleton` — server-side handler
- `ClientLLMService` — browser-side HTTP proxy
- `ProxyLLMService` — base class for decorators

---

## Provider Implementations

### Provider Comparison

```
+------------------------------------------------------------------+
|                     LLMService Interface                          |
|  complete(x, request)    chat(x, messages, options)              |
+-------+----------+----------+-----------+------------------------+
        |          |          |           |
   +----v---+ +----v----+ +--v------+ +--v-------+
   | Claude | | OpenAI  | |DeepSeek | | Ollama   |
   +--------+ +---------+ +---------+ +----------+
   | Java   | | Java    | |Extends  | |Extends   |
   | only   | | only    | |OpenAI   | |OpenAI    |
   +--------+ +---------+ +---------+ +----------+
   |Model:  | |Model:   | |Model:   | |Model:    |
   |claude- | |gpt-4o   | |deepseek-| |llama3    |
   |sonnet  | |         | |chat     | |          |
   +--------+ +---------+ +---------+ +----------+
   |API:    | |API:     | |API:     | |API:      |
   |anthropic| |openai   | |deepseek | |localhost |
   |.com    | |.com     | |.com     | |:11434    |
   +--------+ +---------+ +---------+ +----------+
```

### Claude Provider (`ClaudeLLMService.js`)

The default provider. Sends raw HTTP POST to the Anthropic Messages API:

```java
// Request structure (built in doRequest)
{
  "model":      "claude-sonnet-4-20250514",
  "max_tokens": 8192,
  "messages":   [{"role": "user", "content": "..."}],
  "system":     "You are a REFLOW command generator...",
  "temperature": 0.2
}
```

Headers:
- `x-api-key` — injected from CSpec config
- `anthropic-version` — `2023-06-01`
- `Content-Type` — `application/json`

Response parsing extracts all `"type": "text"` content blocks and concatenates them.

### OpenAI Provider (`OpenAILLMService.js`)

Same pattern, different API shape. System prompt becomes a separate message with `role: "system"`. Uses `Bearer` token auth. Extracts `choices[0].message.content`.

### DeepSeek and Ollama

Both extend `OpenAILLMService` — they override only `defaultModel` and `baseURL`. DeepSeek and Ollama use OpenAI-compatible APIs, so zero additional code is needed.

---

## Decorator Stack

FOAM uses the **decorator pattern** (same as DAO decorators) to add cross-cutting concerns without modifying provider code.

### Decorator Chain

```
  Request arrives
       |
       v
  +------------------------+
  | LoggingLLMService      |   Logs: model, in/out tokens, latency (ms)
  | (extends ProxyLLM)     |   Catches errors, logs with timing
  +----------+-------------+
             |
             v
  +------------------------+
  | PMLLMService           |   Creates PM instance per method call
  | (extends ProxyLLM)     |   Tracks: /llmService:complete, /llmService:chat
  +----------+-------------+
             |
             v
  +------------------------+
  | ClaudeLLMService       |   Actual HTTP call to Anthropic API
  | (implements LLMService)|   Returns CompletionResponse
  +------------------------+
```

### ConversationalLLMService (JS-only decorator)

Maintains chat history across multiple `complete()` calls within a session:

```
  complete("What DAOs exist?")          complete("Show me the first one")
       |                                       |
       v                                       v
  +----------------------------+         +----------------------------+
  | Append USER message        |         | Append USER message        |
  | to history[]               |         | to history[]               |
  +----------------------------+         +----------------------------+
  | history = [                |         | history = [                |
  |   {USER, "What DAOs..."}  |         |   {USER, "What DAOs..."}   |
  | ]                          |         |   {ASST, "invoiceDAO..."}  |
  +----------------------------+         |   {USER, "Show me..."}     |
             |                           | ]                          |
             v                           +----------------------------+
  delegate.chat(x, history, opts)                   |
             |                                      v
             v                           delegate.chat(x, history, opts)
  +----------------------------+                    |
  | Append ASSISTANT message   |                    v
  | to history[]               |         +----------------------------+
  +----------------------------+         | Append ASSISTANT response  |
                                         | Trim if > 50 messages      |
                                         +----------------------------+
```

This converts stateless `complete()` calls into stateful `chat()` calls automatically.

---

## Reflow Integration

### Where LLM Meets the Console

The Reflow Console is FOAM's document engine. Users type commands into a prompt. The LLM integration adds AI-powered commands that generate and execute other Reflow commands.

```
+================================================================+
|                      REFLOW CONSOLE                             |
|                                                                 |
|  +-----------------------------------------------------------+ |
|  | PROMPT: ? show overdue invoices and chart them by age      | |
|  +-----------------------------------------------------------+ |
|                           |                                     |
|                           v                                     |
|  +-----------------------------------------------------------+ |
|  |  COMMAND DISPATCH                                          | |
|  |                                                            | |
|  |  "?" --> AgentCommand (dryRun: true)                       | |
|  |  "??" or "agent" --> AgentCommand (dryRun: false)          | |
|  |  "llm" --> LLMCommand (direct markdown)                    | |
|  |  "ask" --> AskCommand (hidden, LLM self-query)             | |
|  |  "plan" --> AgentCommand (dryRun: true, planning mode)     | |
|  |  "propose" --> Propose UI (manual proposal)                | |
|  +-----------------------------------------------------------+ |
|                           |                                     |
|                           v                                     |
|  +-----------------------------------------------------------+ |
|  |  GENERATED BLOCKS (rendered in document)                   | |
|  |                                                            | |
|  |  propose FROM invoiceDAO WHERE status = 'OVERDUE'          | |
|  |  [  FROM invoiceDAO WHERE status = 'OVERDUE'    [v] [x] ] | |
|  |                                                            | |
|  |  propose chart bar --x daysOverdue --y amount              | |
|  |  [  chart bar --x daysOverdue --y amount         [v] [x] ] | |
|  +-----------------------------------------------------------+ |
+================================================================+
```

### Three Interaction Modes

```
+---------------------+---------------------+---------------------+
|    ? (propose)      |   ?? (execute)      |   llm (direct)      |
+---------------------+---------------------+---------------------+
|                     |                     |                     |
| User reviews each   | Commands execute   | LLM returns         |
| generated command   | immediately in     | markdown text,      |
| before it runs.     | the flow document. | rendered as-is.     |
|                     |                     |                     |
| +-------+ +------+ | +----------------+  | +----------------+  |
| |Accept | |Reject| | | FROM invoiceDAO|  | | **Summary:**   |  |
| |  [v]  | | [x]  | | | WHERE status.. |  | | There are 42   |  |
| +-------+ +------+ | +----------------+  | | overdue...     |  |
|                     |                     | +----------------+  |
| Human-in-the-loop   | Full autonomy       | No commands,        |
| for safety          | for trusted tasks   | just conversation   |
+---------------------+---------------------+---------------------+
```

---

## The Agent Loop

### AgentCommand Execution Flow

This is the core mechanism — where the LLM generates Reflow commands.

```
  User types: ? show me network fee trends
       |
       v
  +-----------------------------------------------+
  | 1. BUILD SYSTEM PROMPT                         |
  |                                                |
  |    Load all flows named "systemPrompt*"        |
  |    from flowDAO. Extract markdown blocks.      |
  |    Concatenate into one system prompt.         |
  +------------------------+-----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 2. CALL LLM SERVICE                           |
  |                                                |
  |    CompletionRequest {                         |
  |      prompt: "show me network fee trends"      |
  |      options: {                                |
  |        systemPrompt: [80+ commands doc],       |
  |        temperature: 0.2,                       |
  |        model: (optional override)              |
  |      }                                         |
  |    }                                           |
  +------------------------+-----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 3. PARSE RESPONSE                              |
  |                                                |
  |    Strip code fences (```...```)               |
  |    Split by newlines                           |
  |    Filter blank lines and comments (// or #)   |
  |    Result: array of command strings            |
  +------------------------+-----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 4. INSERT INTO FLOW                            |
  |                                                |
  |    For each command line:                       |
  |      if dryRun:  eval_("propose " + line)      |
  |      else:       eval_(line)                   |
  |                                                |
  |    Then delete the original prompt block.       |
  +-----------------------------------------------+
```

### The `ask` Command — Self-Query Loop

The `ask` command closes the reasoning loop. The LLM generates an `ask` command, which executes a Reflow command, captures its output, and feeds the result back to the LLM.

```
  LLM generates:  ask daos
       |
       v
  +---------------------------------+
  | 1. EXECUTE COMMAND              |
  |    eval_("daos")                |
  |    (lists all available DAOs)   |
  +---------------------------------+
       |
       v
  +---------------------------------+
  | 2. WAIT 1300ms                  |
  |    (command needs time to       |
  |     render output)              |
  +---------------------------------+
       |
       v
  +---------------------------------+
  | 3. CAPTURE OUTPUT               |
  |    Read innerText from the      |
  |    block's DOM child node       |
  +---------------------------------+
       |
       v
  +---------------------------------+
  | 4. FEED BACK TO LLM            |
  |    eval_('llm("{asked: daos,   |
  |     response: invoiceDAO,      |
  |     userDAO, ...}")')          |
  +---------------------------------+
       |
       v
  +---------------------------------+
  | 5. CLEANUP                      |
  |    Delete the ask block         |
  +---------------------------------+
```

### Multi-Step Agent Reasoning

The full loop enables multi-step autonomous reasoning:

```
  User: ? analyze fee trends for November

  +---LLM generates---+        +---System executes---+
  |                    |        |                     |
  | ask daos           |------->| Lists all DAOs      |
  |                    |<-------| "mciFeeDAO, ..."    |
  |                    |        |                     |
  | ask describe       |------->| Shows MCIFee model  |
  |   mciFeeDAO        |<-------| "billingCycle, ..." |
  |                    |        |                     |
  | ask FROM mciFeeDAO |------->| Runs query, returns |
  |   WHERE billing... |<-------| tabular results     |
  |                    |        |                     |
  | h1("November Fee   |------->| Renders heading     |
  |   Trend Analysis") |        |                     |
  |                    |        |                     |
  | markdown("Based on |------->| Renders analysis    |
  |   the data...")    |        |                     |
  |                    |        |                     |
  | FROM mciFeeDAO ... |------->| Renders data table  |
  +--------------------+        +---------------------+

  Each "ask" round-trip gives the LLM new information
  to refine subsequent commands.
```

---

## System Prompt

The system prompt lives in `foam/core/reflow/ai/flows.jrl` as a Reflow flow named `systemPrompt`. The `AgentCommand` loads it at runtime by querying `flowDAO` for all flows starting with `systemPrompt`.

### Structure

The prompt teaches the LLM five things:

```
+---------------------------------------------------------------+
|                    SYSTEM PROMPT SECTIONS                       |
+---------------------------------------------------------------+
|                                                                |
|  1. IDENTITY                                                   |
|     "You are a REFLOW command generator."                      |
|     "Respond ONLY with valid REFLOW commands."                 |
|     "Do NOT wrap commands in code fences."                     |
|                                                                |
|  2. BOOTSTRAPPING                                              |
|     "Before answering, first run: ask now();info();"           |
|     This gives the LLM current time and system state.          |
|                                                                |
|  3. INFORMATION GATHERING                                      |
|     ask flows      --> list available flows                    |
|     ask daos       --> list available DAOs                     |
|     ask describe X --> inspect a DAO's model fields            |
|     ask help       --> list available commands                 |
|     ask FROM dao WHERE ... TO CSV --> query data               |
|     ask input("?") --> prompt the user                         |
|                                                                |
|  4. OUTPUT RULES                                               |
|     Conversational text    --> markdown("...")                  |
|     Headings               --> h1("..."), h2("...")            |
|     Data display           --> FROM daoName WHERE ...          |
|     Errors                 --> throw "..." or markdown("...")  |
|     String newlines        --> \\n (never literal newlines)    |
|                                                                |
|  5. COMMAND REFERENCE (80+ commands)                           |
|     Complete table of every Reflow command with descriptions.  |
|     Includes: dao, FROM, cells, chart, canvas, markdown,      |
|     script, button, layout, input, add, describe, flows, etc. |
|                                                                |
+---------------------------------------------------------------+
```

### Key Anti-Patterns (from prompt)

| Do NOT | Do Instead |
|--------|------------|
| Use the `doc` command | Use `markdown` |
| Invent command names | Check the command reference table |
| Wrap output in code fences | Output raw commands |
| Use literal newlines in strings | Use `\\n` |
| Guess DAO names | Run `ask daos` first |
| Guess model fields | Run `ask describe daoName` first |

---

## Command Registry

Commands are registered in `foam/core/reflow/ai/cmds.jrl`:

```
+----------+------------------+---------+-----------------------------+
| Command  | Class            | dryRun  | Behavior                    |
+----------+------------------+---------+-----------------------------+
| llm      | LLMCommand       | n/a     | Direct markdown response    |
| agent    | AgentCommand     | false   | Generate + execute commands |
| ?        | AgentCommand     | true    | Generate + propose commands |
| ??       | AgentCommand     | false   | Generate + execute commands |
| plan     | AgentCommand     | true    | Planning mode (propose)     |
| ask      | AskCommand       | n/a     | Self-query loop (hidden)    |
| propose  | Command (script) | n/a     | Manual proposal creation    |
+----------+------------------+---------+-----------------------------+

All commands set permissionRequired: true.
The "ask" command is hidden — only the LLM invokes it, never users.
```

---

## Proposal UI

When `dryRun: true`, each generated command renders as a `Propose` block:

```
+---------------------------------------------------------------+
|                                                                |
|  [3px brand border]  FROM invoiceDAO WHERE status='OVERDUE'    |
|  [    left side   ]  +---input field (editable)---+  [v] [x]  |
|                                                                |
+---------------------------------------------------------------+
     |                                                  |    |
     |                                          Accept  |    | Reject
     |                                          (green) |    | (red)
     |                                                  v    v
     |                                           eval_(cmd)  block.del()
     |                                           block.del()
     |
     +-- Monospace font, tertiary background, brand-colored left border
```

The user can **edit** the command in the input field before accepting. This enables human refinement of LLM-generated commands.

---

## Configuration

### Service Stack (services.jrl)

The CSpec wires the full decorator chain in one line:

```java
// Innermost to outermost:
ClaudeLLMService
  --> wrapped by PMLLMService
    --> wrapped by LoggingLLMService
      --> exposed via LLMServiceSkeleton
        --> called from ClientLLMService (browser)
```

### Swapping Providers

Change one line in `services.jrl` to switch from Claude to OpenAI:

```
// Replace ClaudeLLMService with OpenAILLMService in serviceScript
// Set the API key in deployment.cfg:
//   foam.core.ai.OpenAILLMService.apiKey = sk-xxxxx
```

For local development with Ollama (no API key needed):

```
// Use OllamaLLMService — hits localhost:11434
// No API key required
```

### API Key Injection

```
+---------------------------------------------------+
|  deployment.cfg (per environment)                  |
+---------------------------------------------------+
|                                                    |
|  # Production                                      |
|  foam.core.ai.ClaudeLLMService.apiKey = sk-ant-... |
|                                                    |
|  # Or for OpenAI                                   |
|  foam.core.ai.OpenAILLMService.apiKey = sk-...     |
|                                                    |
+---------------------------------------------------+
          |
          v
  CSpec property injection at boot time.
  Keys stay server-side. ClientLLMService
  only sends requests via SessionClientBox.
```

---

## Gotchas

1. **API keys are server-side only**
   - All four providers run in Java. The browser never touches API keys.
   - If you need the LLM from JavaScript, import `llmService` — it proxies through `ClientLLMService` over HTTP.

2. **`ask` uses a 1300ms sleep**
   - `AskCommand` waits 1300ms for the executed command to render before scraping its DOM output. Long-running queries may return incomplete results.
   - The code has a TODO: "make commands return promises" to eliminate this timing issue.

3. **System prompt loaded from flowDAO, not hardcoded**
   - `AgentCommand.buildSystemPrompt_()` queries `flowDAO` for all flows whose name starts with `systemPrompt`. If no matching flow exists, the LLM gets no instructions and produces unpredictable output.

4. **Temperature defaults differ by command**
   - `AgentCommand` sets `temperature: 0.2` (deterministic command generation)
   - `LLMCommand` uses the default `1.0` (creative markdown responses)
   - Override per-call via the `model` property on each command.

5. **ConversationalLLMService is JS-only**
   - The chat history decorator only works client-side. Server-side calls through `LoggingLLMService` and `PMLLMService` are stateless.
   - History caps at 50 messages and trims oldest first.

6. **Code fences stripped but not always caught**
   - `AgentCommand.parseCommandLines_()` strips `` ```lang `` fences, but nested or indented fences may survive. The system prompt explicitly tells the LLM not to use them.

7. **DeepSeek and Ollama reuse OpenAI's implementation**
   - They extend `OpenAILLMService` and override only `defaultModel` and `baseURL`. Any OpenAI-compatible API works with this pattern (Groq, Together, etc.).

8. **`debugger` statements in LLMCommand.js**
   - Two `debugger` breakpoints exist in the `execute` method. These pause execution in browser DevTools if the console is open.
