<flow name="AI" category="MANUAL" description="How to use REFLOW AI commands." accessLevel="1"/>
# FLOW/Agent User Guide

## Introduction

FLOW/Agent adds AI capabilities to REFLOW through four commands. Instead of chatting with an AI and manually acting on its suggestions, the AI generates REFLOW commands directly — the same commands you would type yourself. The result is a flow document you can edit, save, and reuse.

## The Four Commands

Two commands are for human users, and two are used by agents internally.

### Human-Facing Commands

#### `ai` — Ask a Question

The simplest command. Ask the AI a question and get a conversational response displayed as markdown in your flow.

```
ai What is a chargeback reason code 4837?
ai Explain the difference between first and second presentment.
ai Summarize the Mastercard dispute timeline rules.
```

Use `ai` when you want information, not actions.

#### `agent` — Generate Commands

The core of FLOW/Agent. Give the agent a natural language instruction and it generates REFLOW commands to accomplish the task. Available in two modes:

**`?` — Safe mode.** The agent generates commands but each one is wrapped in a `propose` block for your review before execution. You can edit, accept (✓), or reject (✕) each command individually. This is the recommended default.

```
? show me all overdue invoices sorted by amount
? create a spreadsheet comparing Q1 and Q2 revenue
? build a dashboard showing daily transaction volumes
```

**`!` — Direct mode.** The agent generates commands and they execute immediately without review. Use this for trusted workflows or tasks where you're confident in the agent's output.

```
! show me today's date
! list all available DAOs
! create a markdown summary of the userDAO schema
```

**`agent` — Same as `!`.** The full command name, equivalent to the `!` shortcut.

### Agent-Facing Commands

These commands are used by agents internally to gather information and present proposals. You don't typically type them yourself, though you can include them in system prompts and hints flows.

#### `ask` — Gather Information

Lets the agent execute a command and receive the output, so it can reason about the environment before proposing actions. This is what makes agents intelligent rather than blind — they can explore before they act.

The agent can ask for:

| What | Command |
|---|---|
| Available DAOs | `ask daos` |
| DAO structure | `ask describe invoiceDAO` |
| Available commands | `ask help` |
| Available flows | `ask flows` |
| Current time and system info | `ask now` |
| General system info | `ask info` |
| Query data | `ask FROM invoiceDAO WHERE status = 'OVERDUE' TO CSV` |
| Read a flow document | `ask this.includeFlow("flowName")` |
| Get user input | `ask input("What date range?")` |

#### `propose` — Present a Command for Review

Displays a single command in an editable text field with accept (✓) and reject (✕) buttons. When an agent runs in safe mode (`?`), all of its generated commands are automatically converted into `propose` blocks so the user can validate each one before it executes.

```
propose FROM invoiceDAO WHERE status = 'OVERDUE' ORDER BY amount DESC
```

The command appears in an editable field. You can modify it before accepting. Press ✓ to execute or ✕ to discard.

## Getting Started

### Your First Agent Interaction

Open a REFLOW console and type:

```
? what can you do?
```

The agent will bootstrap itself by checking available commands, DAOs, and services, then respond with an overview of its capabilities. Each proposed command appears for your review.

### A Practical Example

Suppose you want to see overdue invoices:

```
? show me all overdue invoices and chart them by age
```

The agent might propose:

```
propose FROM invoiceDAO WHERE status = 'OVERDUE'
propose cells ...
propose ...
```

Review each one. Edit if needed. Accept the ones you want. Reject any that don't look right. The accepted commands execute and produce live artifacts in your flow.

If the result is useful, save the flow. If you want it to run repeatedly without the LLM, delete the original `?` command and keep just the three generated commands. You now have a deterministic, reusable flow.

## Configuring LLM Providers

### Available Providers

FLOW/Agent supports multiple LLM providers through the `LLMService` interface. Each provider is a server-side implementation — API keys are never exposed to the client.

| Provider | Service Class | Default Model |
|---|---|---|
| Anthropic Claude | `ClaudeLLMService` | `claude-sonnet-4-20250514` |
| OpenAI | `OpenAILLMService` | `gpt-4o` |
| DeepSeek | `DeepSeekLLMService` | `deepseek-chat` |
| Ollama (local) | `OllamaLLMService` | `llama3` |

### Setting the API Key

API keys are stored as vault aliases in `foam3/src/foam/core/ai/credentials.jrl` and resolved at runtime via `credentialDAO`. The literal values live in `../var/dev-secrets.env` (gitignored — never commit it):

```
foam/llm/claude/api-key=sk-ant-api03-xxxxx
foam/llm/openai/api-key=sk-xxxxx
foam/llm/deepseek/api-key=sk-xxxxx
```

Copy `dev-secrets.env.template` to `dev-secrets.env` and fill in real values. Ollama runs locally and requires no API key.

For production, swap the `vaultSecrets` CSpec in `foam3/deployment/vault/services.jrl` to `AWSSecretsManager` — the credentials in `credentials.jrl` are environment-agnostic and need no changes.

### Switching Providers

To change the active LLM provider, update the `serviceClass` in your `services.jrl`:

```
p({"class":"foam.core.boot.CSpec", "name":"llmService", ... "serviceClass":"foam.core.ai.llm.provider.ClaudeLLMService", ...})
```

Replace `ClaudeLLMService` with your preferred provider. All other wiring (skeleton, client, decorators) remains the same.

### Authorization, Logging, and Monitoring

LLM services are authorized just like all other FOAM services — access is controlled through the standard GRANT permission system. All LLM activity is automatically logged and performance monitored (PM'd) through FOAM's decorator stack. This means you get request/response logging, latency tracking, and token usage metrics out of the box, with no additional configuration. The same dashboards and tools you use to monitor other FOAM services work for LLM services.

### Adding a New Provider

If the new provider uses an OpenAI-compatible API (most do), create a class that extends `OpenAILLMService` and override the URL and default model:

```javascript
foam.CLASS({
  package: 'foam.core.ai.llm.provider',
  name: 'MyProviderLLMService',
  extends: 'foam.core.ai.llm.provider.OpenAILLMService',
  properties: [
    { class: 'String', name: 'defaultModel', value: 'my-model-name' },
    { class: 'String', name: 'baseURL',      value: 'https://api.myprovider.com/v1/chat/completions' }
  ]
});
```

Add an entry to `foam3/src/foam/core/ai/credentials.jrl` and a matching alias in `../var/dev-secrets.env`, then update `services.jrl` to look up the new credential by ID. That's it.

For providers with a non-standard API (like Claude's), implement the `LLMService` interface directly with a `complete()` and `chat()` method that handle the provider-specific HTTP request and response format.

## System Prompts

System prompts tell the agent what it knows, what it can do, and how it should behave. They are FLOW documents — editable, executable, permissioned, and composable.

### How System Prompts Are Loaded

The `AgentCommand` automatically loads all flows whose names start with `systemPrompt`. These are composed into the agent's knowledge base in layers:

| Layer | Scope | Example |
|---|---|---|
| **Global** | All users, all institutions | Command syntax, conventions, bootstrapping |
| **SPID** | Per institution | Compliance rules, approval thresholds, terminology |
| **Module/Role** | Per GRANT permission | Chargeback procedures, admin operations |
| **Agent-specific** | Per specialist agent | Chargeback agent knowledge, onboarding flows |
| **Personal** | Per user (private) | Shortcuts, preferences, frequently used queries |

You don't need to configure which prompts load — permissions determine visibility automatically. A user with chargeback module access sees chargeback system prompts. An admin sees admin prompts. A user at Bank A sees Bank A's SPID prompts.

### Creating a Global System Prompt

Create a new flow named `systemPrompt` (or `systemPrompt-descriptiveName`). This flow is available to all agents across the platform.

Example content:

```
markdown("## Conventions\n- Always use FROM instead of dao for queries\n- Use markdown for explanations\n- Prefer cells over plain text for tabular data")
```

Because system prompts are executable flows, they can run commands to dynamically populate themselves:

```
markdown("## Available Commands")
help
markdown("## Available DAOs")
daos
markdown("## Available Services")
services
```

When the agent loads this flow, it executes these commands and receives their current output — so the agent's knowledge is always up to date with the live environment.

### Creating an Institution-Specific System Prompt

Create a flow named `systemPrompt-yourInstitution` scoped to your SPID. Only users and agents operating within that SPID will see it.

Example for a bank:

```
markdown("## Institution Policies\n- All chargeback responses require manager approval for amounts over $5,000\n- Use reason code 4837 documentation from section 3.2 of our internal playbook\n- Reconciliation reports must include the GL account mapping\n- Preferred currency display: CAD")
```

### Creating a Personal System Prompt

Create a flow named `systemPrompt-personal` (or similar) and keep it private — don't share it. This is your personal `.profile` for the agent. Only your sessions will load it.

Example:

```
markdown("## My Preferences\n- I prefer concise responses\n- When showing data, default to cells rather than markdown tables\n- I work primarily with the transactionDAO and invoiceDAO\n- My timezone is EST")
```

### Creating an Agent-Specific System Prompt

Specialist agents are configured with specific flows to load. Create a flow named `systemPrompt-chargebackAgent` (or whatever the agent's specialization is) and reference it in the agent's configuration.

These flows typically include:

- Domain-specific terminology and rules
- Relevant manual sections loaded via `ask this.includeFlow("manualName")`
- Examples of correct command sequences for common tasks
- Pointers to relevant DAOs and their schemas

### Tips for Effective System Prompts

**Include examples.** Show the agent what good command sequences look like for your domain. The `input → command` pattern works well:

```
markdown("Examples:\n- show overdue invoices → FROM invoiceDAO WHERE status = 'OVERDUE'\n- count transactions by type → FROM transactionDAO GROUP BY type SELECT COUNT(*)")
```

**Use `ask` for dynamic content.** Rather than hardcoding DAO names or command lists, let the flow execute commands that produce current information. This way your system prompt never goes stale.

**Be specific about pitfalls.** If there are common mistakes the agent makes in your domain, call them out explicitly:

```
markdown("## Pitfalls\n- Do NOT use the doc command — use markdown instead\n- The transactionDAO uses 'txnDate' not 'date' for the date field\n- Amount fields are in cents, not dollars")
```

**Layer rather than duplicate.** If two agents need the same base knowledge, put it in a shared system prompt and let each agent add its specialization on top. The layering system handles composition automatically.

## Conversation History

The agent maintains conversation context within your current session. If you ask a follow-up question, the agent remembers what you discussed:

```
? show me the invoiceDAO schema
? now query it for overdue items over $10,000
? chart those results by customer
```

Each `?` or `!` command builds on the prior context. The agent knows "it" refers to the invoiceDAO and "those results" refers to the overdue items because the conversation history is maintained.

History resets when you start a new console session.

## Multi-Agent Collaboration

### Delegating to Other Agents

An agent can delegate work to a specialist:

```
ask agent "analyze this chargeback case for reason code 4837"
```

The specialist agent brings its own system prompts and domain knowledge. Its response flows back into the current document.

### Knowledge Absorption

Instead of delegating, an agent can read another agent's training flows to acquire its knowledge:

```
ask this.includeFlow("systemPrompt-chargebackAgent")
```

This merges the specialist's knowledge into the current agent's context — useful for cross-domain tasks where you need one agent with combined expertise.

### Router Pattern

A lightweight agent can triage requests and route to specialists:

```
? I need help with a Mastercard dispute for reason code 4837 involving a $15,000 transaction
```

The router agent classifies the request, identifies the relevant specialist (chargeback agent), and delegates. The user sees the specialist's output in their flow. Adding a new specialist agent is updating the router's system prompt description, not modifying code.

## Compiling Flows

One of FLOW/Agent's most powerful capabilities is turning agent-generated commands into permanent, deterministic workflows.

### The Process

1. Use `?` to have the agent generate commands for a task
2. Review and accept each proposed command
3. Test the resulting flow against known data using FLOAT
4. Once satisfied, delete the original `?` command
5. Save the flow

The saved flow now runs without any LLM involvement. It executes the same commands identically every time — no token costs, no variability, no data exposure to external APIs.

### Converting to FLOAT Tests

Commands that the agent discovered through experimentation can be converted into FLOAT (FLOw Active Tests) to ensure stability:

```
test("Overdue invoice query returns results", FROM invoiceDAO WHERE status = 'OVERDUE', expectRows > 0)
testresults
```

If a future platform change breaks the flow, the FLOAT test catches it automatically.

## Troubleshooting

**Agent proposes invalid commands.** The agent may occasionally generate commands that don't exist or use incorrect syntax. REFLOW's grammar parser will produce a precise error with hints. Use `?` mode so you can reject invalid commands before they execute.

**Agent doesn't know about a DAO.** Make sure the agent bootstraps itself. The system prompt should include `ask daos` or the agent should run `ask describe daoName` to learn about available data. If a DAO is new, the agent will discover it dynamically — no system prompt update needed.

**Agent gives generic responses.** The agent may not have enough domain context. Create or enhance system prompt flows with domain-specific examples, terminology, and common command patterns. The more specific the training, the better the output.

**Agent exposes sensitive data.** Configure an on-premises guardrail model (Ollama) as a mandatory first-pass decorator in the LLMService chain. The guardrail screens all requests and routes sensitive content to the local model, ensuring it never reaches an external API.

**Want to switch models for a specific task.** Use the `model` property on the agent command to override the default provider for a single request, or configure different specialist agents to use different providers.

## Future Work

**Named agent selection.** The ability to specify which agent you wish to use in both the `ai` and `agent` commands. For example, `? @chargeback analyze this dispute` or `ai @onboarding what documents does this customer need?` would route directly to a specialist agent with the appropriate domain knowledge and system prompts. Calling `agent @agentName` without a prompt would switch to that agent as the default for the current session, so subsequent `?` and `!` commands use the specialist automatically.

**Interactive callback links.** The ability for agents to embed callback links in markdown documents, creating inline questions for users to answer. An agent could generate a report with clickable options — "Should I proceed with representment? Yes No Need more info" — where each option triggers a follow-up agent action. This turns agent output from static documents into interactive workflows.

**AI toolbar.** A dedicated toolbar where `agent` is the default command, so users simply type their natural language instruction without needing to prefix it with `?`, `!`, or `agent`. The toolbar includes a checkbox to toggle between safe mode (propose) and direct mode (execute), and a dropdown selector for choosing the current agent. This provides a streamlined, discoverable interface for users who prefer graphical controls over command-line shortcuts.

**LLM request/response DAO.** A DAO decorator that stores all LLM service requests and responses for later analysis. Every prompt sent and completion received would be recorded as structured data, queryable and analyzable in REFLOW itself. This enables usage auditing, cost analysis, prompt quality evaluation, response time tracking, and the ability to replay or refine past interactions — all using the same REFLOW tools (cells, charts, FROM queries) used for any other data.

## Quick Reference

| Command | Shortcut | Used By | Description |
|---|---|---|---|
| `ai` | — | Human | Ask the AI a question, get a text response |
| `agent` | `!` | Human | Agent generates and executes commands directly |
| `agent` | `?` | Human | Agent generates commands for human review (safe mode) |
| `ask` | — | Agent | Agent executes a command and reads the result |
| `propose` | — | Agent | Display a command for edit/accept/reject (generated by safe mode) |

----

| System Prompt Layer | Flow Name Pattern | Controlled By |
|---|---|---|
| Global | `systemPrompt` | Platform admin |
| Institution | `systemPrompt-*` scoped to SPID | Customer admin |
| Module/Role | `systemPrompt-*` with GRANT | Permission system |
| Agent-specific | `systemPrompt-agentName` | Agent configuration |
| Personal | `systemPrompt-personal` (private) | Individual user |