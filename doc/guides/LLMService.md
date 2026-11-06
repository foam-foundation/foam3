<flow name="LLMService" category="DOC/GUIDE" spid="foam" description="Technical reference for llmService: interface, providers, decorator stack, credentials, and the Reflow AI commands built on it." keywords="llm,ai,agent,reflow,claude,openai,ollama,knowledge"/>

# FOAM3 LLM Service

`llmService` sends a prompt to a language model and returns its reply, from Java or JavaScript, with
the same two methods for every provider. The Reflow AI commands (`ai`, `agent`, `?`, `!`) are built
on it. This guide covers how the pieces fit and what to watch for. For how to use the commands from
a flow, read the `AI` manual flow (`foam/core/reflow/ai/flows.jrl`).

## Table of Contents
1. [Quick Start](#quick-start)
2. [Key Files](#key-files)
3. [Architecture](#architecture)
4. [Core Data Models](#core-data-models)
5. [Providers](#providers)
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

Import the service and call `complete`:

```javascript
imports: [ 'llmService' ],
requires: [ 'foam.ai.llm.CompletionRequest', 'foam.ai.llm.LLMOptions' ],
// ...
var response = await this.llmService.complete(null, this.CompletionRequest.create({
  prompt:  'Summarize this data',
  options: this.LLMOptions.create({ temperature: 0 })
}));
console.log(response.content);
```

From Java, look the service up in the context. The `options` factory exists only in JavaScript, so
a Java caller sets `LLMOptions` itself:

```java
LLMService  llm  = (LLMService) x.get("llmService");
LLMOptions  opts = new LLMOptions();
opts.setTemperature(0);

CompletionRequest req = new CompletionRequest();
req.setPrompt("Summarize this data");
req.setOptions(opts);

LLMResponse res = llm.complete(x, req);
```

The API key comes from a credential row, `foam/llm/claude`, whose secret lives in the
`vaultSecrets` vault. Setting up that vault for local development is covered in
[CredentialManagement.md](CredentialManagement.md#local-development).

A browser user also needs the `service.llmService` permission, because the CSpec sets
`authenticate: true` (see [Configuration](#configuration)).

---

## Key Files

The interface and the browser-side pieces live in `foam/ai/llm`. The Java providers and decorators
live in `foam/core/ai/llm`.

| File | Purpose |
|------|---------|
| `foam/ai/llm/LLMService.js` | Interface, request and response models, `ChatRole` enum |
| `foam/ai/llm/ConversationalLLMService.js` | Chat history decorator (JS only) |
| `foam/ai/llm/RAGChat.js` | Retrieval chat view used by the `foam.ai.demos` RAG page |
| `foam/ai/llm/provider/TransformersLLMService.js` | In-browser model through Transformers.js (JS only) |
| `foam/core/ai/llm/LoggingLLMService.js` | Logs model, tokens and latency per call |
| `foam/core/ai/llm/PMLLMService.js` | Performance monitoring per call |
| `foam/core/ai/llm/provider/ClaudeLLMService.js` | Anthropic Messages API |
| `foam/core/ai/llm/provider/OpenAILLMService.js` | OpenAI Chat Completions API |
| `foam/core/ai/llm/provider/DeepSeekLLMService.js` | DeepSeek, extends the OpenAI provider |
| `foam/core/ai/llm/provider/OllamaLLMService.js` | Local Ollama, extends the OpenAI provider |
| `foam/core/ai/services.jrl` | `llmService` CSpec |
| `foam/core/ai/credentials.jrl` | Provider credentials, resolved through the vault |
| `foam/core/reflow/ai/AgentCommand.js` | `agent`, `!`, `?`, `plan`: the model replies with Reflow commands |
| `foam/core/reflow/ai/LLMCommand.js` | `ai`: the model replies with markdown |
| `foam/core/reflow/ai/AskCommand.js` | `ask`: runs a command and sends its output back to the agent |
| `foam/core/reflow/ai/Propose.js` | Review block behind `propose` and `?` |
| `foam/core/reflow/ai/cmds.jrl` | Reflow command registrations |
| `foam/core/reflow/ai/flows.jrl` | `systemPrompt` flow and the `AI` manual flow |

---

## Architecture

### Service Stack

The LLM acts as the current user. It runs the same Reflow commands the user could type, with the
same permissions, and in `?` mode each command waits for the user to accept it before it runs.

```
+=========================================================================================+
|                                      SERVICE STACK                                      |
|                                                                                         |
|  BROWSER (JavaScript)                        SERVER (Java)                              |
| +-------------------------------------+     +----------------------------------------+  |
| |                                     |     |                                        |  |
| |  Reflow Console                     |     |                                        |  |
| |  user types: ? show overdue invoices|     |                                        |  |
| |         |                           |     |                                        |  |
| |         v                           |     |                                        |  |
| |  AgentCommand / LLMCommand          |     |                                        |  |
| |         |                           |     |                                        |  |
| |         v                           |     |                                        |  |
| |  ConversationalLLMService           |     |                                        |  |
| |  (one history per Console)          |     |                                        |  |
| |         |                           |     |                                        |  |
| |         v                           |     |                                        |  |
| |  ClientLLMService ------------------+HTTP-+> LLMServiceSkeleton                    |  |
| |  (SessionClientBox -> HTTPBox)      |     |  (checks service.llmService)           |  |
| |                                     |     |         |                              |  |
| |                                     |     |         v                              |  |
| |                                     |     |  LoggingLLMService                     |  |
| |                                     |     |  (model, tokens, ms)                   |  |
| |                                     |     |         |                              |  |
| |                                     |     |         v                              |  |
| |                                     |     |  PMLLMService                          |  |
| |                                     |     |  (PM per call)                         |  |
| |                                     |     |         |                              |  |
| |                                     |     |         v                              |  |
| |                                     |     |  ClaudeLLMService                      |  |
| |                                     |     |  (key from credentialDAO + vault)      |  |
| |                                     |     |         |                              |  |
| |                                     |     |         v                              |  |
| |                                     |     |  api.anthropic.com                     |  |
| |                                     |     |                                        |  |
| +-------------------------------------+     +----------------------------------------+  |
+=========================================================================================+
```

The reply travels back the same way. `AgentCommand` splits it into command lines and runs each one
in the flow, or wraps it in `propose` first when the command is `?` or `plan`.

### Client-Server Boundary

Only the request and the reply cross the wire. The API key never leaves the server.

```
  BROWSER (JavaScript)                         SERVER (Java)
 +-------------------------------------+     +----------------------------------------+
 |                                     |     |                                        |
 |  CompletionRequest / ChatRequest ---+-----+-> CSpec.checkAuthorization             |
 |  (prompt, messages, LLMOptions)     |  /service/llmService                         |
 |                                     |     |         |                              |
 |                                     |     |         v                              |
 |                                     |     |  credentialDAO.find("foam/llm/claude") |
 |                                     |     |         |                              |
 |                                     |     |         v                              |
 |                                     |     |  vaultSecrets.getSecret(alias)         |
 |                                     |     |         |                              |
 |  LLMResponse <----------------------+-----+-- x-api-key header -> provider         |
 |  (content, model, tokens)           |     |                                        |
 +-------------------------------------+     +----------------------------------------+
```

---

## Core Data Models

All models live in `foam/ai/llm/LLMService.js`, package `foam.ai.llm`.

### ChatRole Enum

| Value | Label | Usage |
|-------|-------|-------|
| `SYSTEM` | `system` | System prompt instructions |
| `USER` | `user` | Human or agent input |
| `ASSISTANT` | `assistant` | Model reply |

### Requests and Response

```
+---------------------+                         +---------------------+
|  LLMRequest         |                         |  LLMResponse        |
|  (abstract)         |      +--------------+   |                     |
|  options -----------+----->|  LLMOptions  |   |  content            |
+----------+----------+      |              |   |  model              |
           |                 |  model       |   |  inputTokens        |
     +-----+------+          |  maxTokens   |   |  outputTokens       |
     |            |          |    (4096)    |   |  stopReason         |
     v            v          |  temperature |   +---------------------+
+-----------+ +-----------+  |    (1.0)     |
|Completion | |ChatRequest|  |  systemPrompt|
|Request    | |           |  +--------------+
| prompt    | | messages  |
+-----------+ | (Chat-    |
              |  Message[])|
              +-----------+
```

`ChatMessage` holds one turn of a conversation:

```javascript
foam.ai.llm.ChatMessage.create({
  role:    'USER',
  content: 'What DAOs are available?'
})
```

### LLMService Interface

| Method | Signature |
|--------|-----------|
| `complete` | `complete(Context x, CompletionRequest request)` returns `LLMResponse` |
| `chat` | `chat(Context x, ChatRequest request)` returns `LLMResponse` |

Both methods are `async` in JavaScript. The interface sets `skeleton: true`, `client: true` and
`proxy: true`, so FOAM generates three classes:

- `LLMServiceSkeleton` — server-side handler for the HTTP box
- `ClientLLMService` — browser-side proxy
- `ProxyLLMService` — base class for decorators

---

## Providers

```
+--------------------------------------------------------------------------+
|                         foam.ai.llm.LLMService                           |
|                complete(x, request)    chat(x, request)                  |
+--------+------------+-------------+-------------+--------------+---------+
         |            |             |             |              |
   +-----v----+ +-----v----+ +------v----+ +------v----+ +-------v-------+
   | Claude   | | OpenAI   | | DeepSeek  | | Ollama    | | Transformers  |
   +----------+ +----------+ +-----------+ +-----------+ +---------------+
   | Java     | | Java     | | extends   | | extends   | | JS only,      |
   |          | |          | | OpenAI    | | OpenAI    | | in browser    |
   +----------+ +----------+ +-----------+ +-----------+ +---------------+
   | claude-  | | gpt-4o   | | deepseek- | | llama3    | | Xenova/Qwen   |
   | sonnet-4-| |          | | chat      | |           | | 1.5-0.5B-Chat |
   | 20250514 | |          | |           | |           | |               |
   +----------+ +----------+ +-----------+ +-----------+ +---------------+
   | foam/llm/| | foam/llm/| | foam/llm/ | | none      | | none          |
   | claude   | | openai   | | deepseek  | | (see note)| |               |
   +----------+ +----------+ +-----------+ +-----------+ +---------------+
```

The last row is the credential id each provider looks up. Every Java provider has `defaultModel`,
`baseURL` and `credentialId` properties, so a CSpec can override any of them.

### Claude (`ClaudeLLMService`)

The default provider. `doRequest` posts to the Anthropic Messages API:

```json
{
  "model":       "claude-sonnet-4-20250514",
  "max_tokens":  4096,
  "messages":    [{ "role": "user", "content": "..." }],
  "system":      "You are a REFLOW command generator...",
  "temperature": 0.2
}
```

- `model` falls back to `defaultModel` when `LLMOptions.model` is empty.
- `max_tokens` is `LLMOptions.maxTokens` (default 4096), or 8192 when that is 0 or less.
- `temperature` is sent only when it is above 0.
- `system` is sent only when `systemPrompt` is set.

Headers are `x-api-key` (from the credential), `anthropic-version` (`2023-06-01`) and
`Content-Type: application/json`. The reply's `text` content blocks are joined with newlines into
`LLMResponse.content`. A non-200 status throws `Claude API error (<status>): <body>`.

### OpenAI (`OpenAILLMService`)

Same flow, different API shape. The system prompt becomes a first message with `role: "system"`,
the key goes in an `Authorization: Bearer` header, and the reply comes from
`choices[0].message.content`.

### DeepSeek and Ollama

Both extend `OpenAILLMService` and override `defaultModel` and `baseURL`. DeepSeek also overrides
`credentialId`. Ollama does not, which matters when the OpenAI secret is missing (see
[Gotchas](#gotchas)).

### Transformers (browser only)

`TransformersLLMService` loads Transformers.js from jsDelivr and runs a small chat model in the
browser tab. Nothing reaches the server. The RAG demo page (`foam.ai.demos.RAGChatPage`) uses it,
wrapped in `ConversationalLLMService`, unless the page's provider is set to `openai`.

---

## Decorator Stack

LLM decorators work like DAO decorators: each one extends `ProxyLLMService`, does its work, and
calls `getDelegate()`.

```
  Request arrives
       |
       v
  +------------------------+
  | LoggingLLMService      |   info:  <class> complete model=... in=... out=... <ms>ms
  | (extends ProxyLLM)     |   error: <class> complete FAILED <message> <ms>ms, then rethrows
  +----------+-------------+
             |
             v
  +------------------------+
  | PMLLMService           |   one PM per complete/chat call
  | (extends ProxyLLM)     |   skipped when enabled is false
  +----------+-------------+
             |
             v
  +------------------------+
  | ClaudeLLMService       |   HTTP call to the provider
  | (implements LLMService)|   returns LLMResponse
  +------------------------+
```

### ConversationalLLMService (JS only)

`ConversationalLLMService` turns separate calls into one conversation. Each Reflow Console wraps
the imported `llmService` in one of these and exports it to its blocks
(`foam/core/reflow/Console.js`, the `llmService` property). So every `ai`, `agent` and `ask` call
in one Console shares a history.

```
  complete("What DAOs exist?")           complete("Show me the first one")
       |                                        |
       v                                        v
  history = [ USER "What DAOs..." ]      history = [ USER "What DAOs...",
       |                                             ASSISTANT "invoiceDAO...",
       v                                             USER "Show me..." ]
  delegate.chat(x, history, options)            |
       |                                        v
       v                                 delegate.chat(x, history, options)
  push ASSISTANT reply                          |
                                                v
                                         push ASSISTANT reply
                                         keep the last 50 messages
```

`complete` becomes a one-message `chat`, and the whole history goes to the server on every call.
`clearHistory()` empties it. The system prompt is not stored in the history; it travels in
`LLMOptions` on each call.

---

## Reflow Integration

The Reflow Console is FOAM's document engine. Users type commands into a prompt; the AI commands
ask the model to write more commands.

```
+================================================================+
|                      REFLOW CONSOLE                            |
|                                                                |
|  +----------------------------------------------------------+  |
|  | PROMPT: ? show overdue invoices and chart them by age    |  |
|  +----------------------------------------------------------+  |
|                           |                                    |
|                           v                                    |
|  +----------------------------------------------------------+  |
|  |  COMMAND DISPATCH                                        |  |
|  |                                                          |  |
|  |  "?" or "plan"     --> AgentCommand (dryRun: true)       |  |
|  |  "!" or "agent"    --> AgentCommand (dryRun: false)      |  |
|  |  "ai"              --> LLMCommand (markdown reply)       |  |
|  |  "ask"             --> AskCommand (hidden, agent only)   |  |
|  |  "propose"         --> Propose block                     |  |
|  +----------------------------------------------------------+  |
|                           |                                    |
|                           v                                    |
|  +----------------------------------------------------------+  |
|  |  GENERATED BLOCKS (rendered in the document)             |  |
|  |                                                          |  |
|  |  [ FROM invoiceDAO WHERE status = 'OVERDUE'    [v] [x] ] |  |
|  |  [ chart bar --x daysOverdue --y amount        [v] [x] ] |  |
|  +----------------------------------------------------------+  |
+================================================================+
```

### Three Interaction Modes

```
+---------------------+---------------------+---------------------+
|    ? (propose)      |   ! (execute)       |   ai (answer)       |
+---------------------+---------------------+---------------------+
| Each generated      | Generated commands  | The model's reply   |
| command waits in a  | run right away in   | is rendered as      |
| propose block.      | the flow.           | markdown.           |
|                     |                     |                     |
| +-------+ +------+  | +----------------+  | +----------------+  |
| |Accept | |Reject|  | | FROM invoiceDAO|  | | **Summary:**   |  |
| |  [v]  | | [x]  |  | | WHERE status.. |  | | There are 42   |  |
| +-------+ +------+  | +----------------+  | | overdue...     |  |
|                     |                     | +----------------+  |
| The user reviews    | For tasks the user  | No commands run.    |
| before anything     | trusts the agent    |                     |
| runs.               | with.               |                     |
+---------------------+---------------------+---------------------+
```

---

## The Agent Loop

### AgentCommand Execution Flow

```
  User types: ? show me network fee trends
       |
       v
  +-----------------------------------------------+
  | 1. BUILD SYSTEM PROMPT                        |
  |    Select every flow whose name starts with   |
  |    "systemPrompt" from flowDAO, ordered by    |
  |    name. Join their Markdown blocks.          |
  |    Cached on the command after the first run. |
  +------------------------+----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 2. CALL llmService.complete                   |
  |    prompt:       the text after "?"           |
  |    systemPrompt: from step 1                  |
  |    temperature:  0.2                          |
  |    model:        the command's model, if set  |
  +------------------------+----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 3. PARSE THE REPLY                            |
  |    Strip ``` fence lines                      |
  |    Split on newlines, trim each line          |
  |    Drop blank lines and lines starting        |
  |    with // or #                               |
  |    No lines left: render the reply as         |
  |    markdown and stop                          |
  +------------------------+----------------------+
                           |
                           v
  +-----------------------------------------------+
  | 4. RUN EACH LINE                              |
  |    dryRun:  eval_("propose " + line)          |
  |    else:    eval_(line)                       |
  |    Then delete the prompt block.              |
  +-----------------------------------------------+
```

### The `ask` Command

`ask` lets the model look before it acts. The model writes `ask daos`; the command runs `daos`,
reads what it rendered, and sends that back to the agent.

```
  Model writes:  ask daos
       |
       v
  +----------------------------------------+
  | 1. eval_("daos")                       |
  +----------------------------------------+
       |
       v
  +----------------------------------------+
  | 2. Wait 1300 ms for the output to      |
  |    render                              |
  +----------------------------------------+
       |
       v
  +----------------------------------------+
  | 3. Read innerText of the block's       |
  |    output node                         |
  +----------------------------------------+
       |
       v
  +----------------------------------------+
  | 4. eval_('agent({"asked":"daos",       |
  |          "response":"invoiceDAO..."})')|
  +----------------------------------------+
       |
       v
  +----------------------------------------+
  | 5. Delete the ask block                |
  +----------------------------------------+
```

The reply goes to `agent`, so the model's next round of commands runs directly, even when the user
started with `?`.

### Multi-Step Reasoning

```
  User: ? analyze fee trends for November

  +---Model writes-----+        +---Console runs------+
  |                    |        |                     |
  | ask daos           |------->| Lists all DAOs      |
  |                    |<-------| "mciFeeDAO, ..."    |
  |                    |        |                     |
  | ask describe       |------->| Shows the model     |
  |   mciFeeDAO        |<-------| "billingCycle, ..." |
  |                    |        |                     |
  | ask FROM mciFeeDAO |------->| Runs the query      |
  |   WHERE ... TO CSV |<-------| returns rows        |
  |                    |        |                     |
  | h1("November Fee   |------->| Renders heading     |
  |   Trends")         |        |                     |
  |                    |        |                     |
  | FROM mciFeeDAO ... |------->| Renders data table  |
  +--------------------+        +---------------------+
```

Each `ask` adds a turn to the Console's history, so the model sees every earlier answer when it
writes the next commands.

---

## System Prompt

The base prompt is the `systemPrompt` flow in `foam/core/reflow/ai/flows.jrl`. `AgentCommand`
joins it with every other flow whose name starts with `systemPrompt`, so an app adds knowledge by
adding a flow such as `systemPrompt-chargebacks`. `LLMCommand` (`ai`) does not load these flows.

### Structure

```
+---------------------------------------------------------------+
|                    SYSTEM PROMPT SECTIONS                     |
+---------------------------------------------------------------+
|                                                               |
|  1. IDENTITY                                                  |
|     "You are a REFLOW command generator."                     |
|     One command per line, no code fences.                     |
|                                                               |
|  2. BOOTSTRAPPING                                             |
|     Run "ask info();" before answering.                       |
|                                                               |
|  3. GATHERING INFORMATION WITH ask                            |
|     ask FROM flowDAO ... TO CSV   --> list flows              |
|     ask FROM cSpecDAO ... TO CSV  --> list DAOs               |
|     ask describe daoName          --> a DAO's properties      |
|     ask FROM commandDAO TO CSV    --> list commands           |
|     ask this.includeFlow("name")  --> read a flow             |
|     ask input("...")              --> prompt the user         |
|                                                               |
|  4. OUTPUT RULES                                              |
|     Text --> markdown("..."), headings --> h1("...")          |
|     Data --> FROM daoName WHERE ..., cells, charts            |
|     Errors --> throw "..." or markdown("...")                 |
|     Strings use \\n, never literal newlines                   |
|                                                               |
|  5. PITFALLS AND COMMAND TABLE                                |
|     Do not use doc, do not invent commands, then a table      |
|     of every Reflow command with a description.               |
|                                                               |
+---------------------------------------------------------------+
```

---

## Command Registry

Commands are registered in `foam/core/reflow/ai/cmds.jrl`:

```
+----------+------------------+---------+-----------------------------+
| Command  | Class            | dryRun  | Behavior                    |
+----------+------------------+---------+-----------------------------+
| ai       | LLMCommand       | n/a     | Markdown reply              |
| agent    | AgentCommand     | false   | Generate and run commands   |
| !        | AgentCommand     | false   | Shorthand for agent         |
| ?        | AgentCommand     | true    | Generate and propose        |
| plan     | AgentCommand     | true    | Same as ?                   |
| ask      | AskCommand       | n/a     | Run a command, reply to the |
|          |                  |         | agent (hidden)              |
| propose  | Command (script) | n/a     | Show one command for review |
+----------+------------------+---------+-----------------------------+
```

Every row sets `permissionRequired: true`. `ask` is `hidden`, so it stays out of the command list
the user sees; the model calls it.

---

## Proposal UI

With `dryRun: true`, each generated line becomes a `Propose` block:

```
+---------------------------------------------------------------+
|                                                               |
|  [3px brand border]  FROM invoiceDAO WHERE status='OVERDUE'   |
|  [    left side   ]  +---input field (editable)---+  [v] [x]  |
|                                                               |
+---------------------------------------------------------------+
                                                       |    |
                                               accept  |    | reject
                                                       v    v
                                            eval_(command)  block.del()
                                            block.del()
```

The user can edit the command before accepting it.

---

## Configuration

### Service Stack (services.jrl)

The `llmService` CSpec in `foam/core/ai/services.jrl` builds the stack in its `serviceScript`:

```java
return new foam.core.ai.llm.LoggingLLMService.Builder(x)
  .setDelegate(new foam.core.ai.llm.PMLLMService.Builder(x)
    .setDelegate(new foam.core.ai.llm.provider.ClaudeLLMService.Builder(x).build())
    .build())
  .build();
```

The CSpec also sets `serve: true`, `authenticate: true` and the browser `client` (a
`ClientLLMService` over `SessionClientBox` and `HTTPBox` to `service/llmService`). With
`authenticate: true`, every call checks the `service.llmService` permission
(`CSpec.checkAuthorization`).

An app replaces the stack by defining its own CSpec named `llmService` in a journal that loads
later. Its decorators extend `foam.ai.llm.ProxyLLMService`, the same way `LoggingLLMService` does.

### Swapping Providers

Swap the provider class in `serviceScript`. Each provider reads its own credential id
(`foam/llm/openai`, `foam/llm/deepseek`):

```java
.setDelegate(new foam.core.ai.llm.provider.OpenAILLMService.Builder(x).build())
```

To use a different model or endpoint without a new class, set the provider's properties:

```java
new foam.core.ai.llm.provider.ClaudeLLMService.Builder(x)
  .setDefaultModel("<model id>")
  .setCredentialId("myapp/llm/claude")
  .build()
```

For a local Ollama server, set an empty key so the provider skips the credential lookup:

```java
new foam.core.ai.llm.provider.OllamaLLMService.Builder(x).setApiKey("").build()
```

### API Keys

Each Java provider resolves its key on first use:

```
  provider.getApiKey()
       |
       v
  credentialDAO.find(credentialId)            "foam/llm/claude"
       |                                      (foam/core/ai/credentials.jrl)
       v
  APIKeyCredential.getApiKeySecret(x)
       |
       v
  vaultSecrets.getSecret("foam/llm/claude/api-key")
       |
       v
  the real key, held on the provider instance
```

`vaultSecrets` is a CSpec each deployment configures: `FileKeyStoreManager` for local development,
`AWSSecretsManager` on ECS. A missing credential row throws `LLM credential not found: <id>`. The
vault setup, the alias naming convention and the local secrets file are in
[CredentialManagement.md](CredentialManagement.md).

---

## Gotchas

1. **`temperature` defaults to 1.0 and is always sent**
   - `LLMOptions.temperature` defaults to 1.0, and the Claude and OpenAI providers send it whenever
     it is above 0. `LLMCommand` (`ai`) never sets it, so its calls send 1.0.
   - Set `temperature: 0` to leave the field out of the request, for example on models that do not
     accept sampling parameters.

2. **Every Console call resends the whole conversation**
   - The Console's `ConversationalLLMService` sends all earlier turns on each call, up to 50
     messages. A long agent session with many `ask` round trips grows each request.
   - The decorator is shared by every block in that Console.

3. **`ask` waits a fixed 1300 ms**
   - `AskCommand` sleeps 1300 ms before reading the block's rendered text. A query that renders
     later sends partial or empty output to the agent.
   - The code carries a TODO to make commands return promises instead.

4. **`ask` replies through `agent`, not `?`**
   - The `ask` reply runs `agent(...)`, whose `dryRun` is false. After the first `ask`, the agent's
     commands run without a propose step, even in a session started with `?`.

5. **System prompt flows are matched by name prefix**
   - `buildSystemPrompt_` loads every flow whose name starts with `systemPrompt`. A flow meant for
     another feature with that prefix becomes part of every agent prompt. With no matching flow,
     the agent runs with no instructions.
   - The joined prompt is cached in the command's `systemPrompt` property after the first call, so
     a flow edited later does not reach a command object that already ran.

6. **`AgentCommand.execute` passes an undeclared `x`**
   - `this.llmService.complete(x, request)` refers to a free variable `x`, which works only where a
     global `x` exists. `LLMCommand` passes `null` instead; copy that form.

7. **PM names have no service prefix**
   - `PMLLMService` names its PMs `/<cspec name>:complete` when it knows its CSpec. The CSpec
     factory sets the CSpec only on the outermost service and walks `ProxyDAO` and
     `ProxyAuthService` delegates, not `ProxyLLMService`. In the stock stack `PMLLMService` sits
     under `LoggingLLMService`, so its PMs are named `:complete` and `:chat`.

8. **Ollama inherits the OpenAI credential**
   - `OllamaLLMService` keeps `credentialId: "foam/llm/openai"` from its parent. Without
     `setApiKey("")`, its first call looks up the OpenAI secret and throws when the vault has
     none.

9. **Lines starting with `#` are dropped**
   - `parseCommandLines_` drops lines starting with `//` or `#`, so a markdown heading the model
     writes on its own line is discarded. The system prompt asks for `h1(...)` and
     `markdown(...)` instead.
