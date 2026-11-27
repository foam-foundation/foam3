# AI agents in Reflow

The design is an AI agent that is one more user of the Console: it types Reflow commands, and the platform runs them under the same permissions as a person's. The guide is `ai/AI.md`; the review rules are in `foam-design-patterns`, `references/reflow.md` ("AI agents"). This page separates what the code does from what the guide lists as direction. Paths are under `src/foam/core/reflow/ai/`.

## What the code does

| Piece | Behaviour | Where |
|---|---|---|
| commands | `ai`, `agent`, `!`, `?`, `plan`, `ask`, `propose`; every row has `permissionRequired: true`, so a person needs `command.read.<id>` for each | `cmds.jrl` |
| `agent`, `!` | send one request, run each returned command line | `AgentCommand.js:82-135` |
| `?`, `plan` | the same, with `dryRun` true: each line is run as `propose <line>` | `AgentCommand.js:73-77`, `:116` |
| reply parsing | blank lines, `//` lines and `#` lines are dropped; code fences are stripped | `AgentCommand.js:157-167` |
| a line that fails to parse | the error is sent back to the agent as `agent({ message: 'Syntax Error', ... })` | `AgentCommand.js:118-123` |
| waiting | each line's block is awaited through `onLoad`, so a later line waits for an `input` to be answered | `AgentCommand.js:124-129` |
| the prompt block | deleted after the run; it was a request, not content | `AgentCommand.js:133-134` |
| `propose` | a block with accept and reject. Accept runs the command through `eval_` and answers with the made block's answer; reject answers that it did not run | `Propose.js:110-127` |
| system prompt | every flow whose name starts with `systemPrompt`, ordered by name, joined; only blocks whose value is a `Markdown` are used, any other block is dropped silently; the text is built again on every call: each call runs on a clone of the command (`Console.js:1461`), so the `systemPrompt` it sets is lost and the flows are read again | `AgentCommand.js:137-155` |
| tool calling | `CommandTool` offers the model one tool, `execute_command`, whose only input is a script; `prefix`, `predicate`, `maxResult` and `commandX` limit it | `CommandTool.js:20-130` |

`predicate` on `CommandTool` matters when the agent reads text it did not write: set, each script must be one call of a matching command with JSON data as its argument (`CommandTool.js:22-24`, `:52-56`, `:99-100`).

An accepted proposal and a script run through the tool enter the prompt history like a typed command, except scripts run under a hidden `flowParent` (`CommandTool.js:103-106`).

## To add an ability

Add a command (`commands.md`) with `permissionRequired: true`. The agent reaches it through `execute_command` with the same grant as a person. Do not add a second tool or registry (`foam-design-patterns`, `references/reflow.md`). If the command's result should read well to a model, give it an `answer()` that returns text (`cmd/Flows.js:38-40`, `Block.js:215-219`).

## To give an agent knowledge

Add a flow named `systemPrompt-<topic>` with Markdown blocks. A flow has an access level and a tenant, so the prompt text reaches only people who can read that flow (`access.md`). Use a different name prefix for a prompt that is not for the Console agent: every flow that starts with `systemPrompt` is loaded into every `agent` call (`AgentCommand.js:139`).

## Direction only (listed in `AI.md`, "Future Work", not in the code above)

- choosing a named agent in `ai` and `agent`;
- links in generated documents that call back into the agent;
- a toolbar with `agent` as the default command and a safe-mode switch;
- a DAO that records every LLM request and response.

The guide's "Conversation History" section describes memory across prompts. The Console's `llmService` is a `ConversationalLLMService` over its parent (`Console.js:978-985`); `AgentCommand` sends each call as one `CompletionRequest` through `llmService.complete` (`AgentCommand.js:85-98`). Read `foam/ai/llm/ConversationalLLMService.js` before relying on history across calls.
