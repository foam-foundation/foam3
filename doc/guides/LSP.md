# FOAM LSP and MCP — Setup

The FOAM Language Server gives your editor completion, hover, go-to-definition,
find-references and diagnostics for `foam.CLASS` files and `.jrl` journals. The
same server also runs as an MCP server, so a coding agent (Claude Code, Codex,
Gemini CLI, Cursor, Pi) can ask it the same questions instead of grepping.

Both need Node.js and a FOAM project root, the directory that holds `pom.js`
and `foam3/`. Run every command below from that root.

## Editor setup

```bash
./build.sh lsp-install              # lists the editors and agents found on PATH, asks which to set up
./build.sh lsp-install:vscode       # builds the extension, installs the .vsix; restart VS Code after
./build.sh lsp-install:emacs        # copies lsp-foam.el to ~/.emacs.d/site-lisp/, prints the init.el snippet
./build.sh lsp-install:zed          # prints the Install Dev Extension steps; needs Rust from rustup
./build.sh lsp-install:all          # every editor and agent found on PATH
```

The VS Code extension activates in any workspace that contains `pom.js`. For
Emacs, add the printed snippet to `init.el` and restart. For Zed, pick the
`foam3/tools/lsp/editors/zed-foam3` folder when Zed asks for the extension
directory.

Any other LSP client works too. Point it at this command, with the project
root as the working directory and stdio as the transport:

```bash
node foam3/tools/lsp-start.js
```

## Agent setup (MCP)

```bash
./build.sh lsp-install:claude-code  # writes the foam-lsp entry to .mcp.json
./build.sh lsp-install:codex        # writes it to .codex/config.toml
./build.sh lsp-install:gemini       # writes it to .gemini/settings.json
./build.sh lsp-install:cursor       # writes it to .cursor/mcp.json
./build.sh lsp-install:pi           # writes it to .pi/mcp.json
```

Other entries already in the file are kept. Restart the agent afterwards. In
Claude Code, run `/mcp` and approve the project `.mcp.json`.

The agent then has tools named `foam_hover`, `foam_definition`,
`foam_references`, `foam_type_hierarchy`, `foam_workspace_symbols`,
`foam_diagnostics` and a few more. They take a `symbol` such as `DetailView`,
`foam.u2.DetailView` or `foam.u2.DetailView.data`, so the agent never has to
open a file to count columns first.

## First start

The server loads every FOAM model on boot, which takes 10 to 15 seconds. In an
editor that shows as a short delay before the first completion. In an agent
session only the first tool call pays it.

To check the server itself without an editor:

```bash
node foam3/tools/tests/testFoamLSP.js
```

## Team settings

A `foam-lsp.json` at the project root sets defaults for everyone who opens the
repo, for example turning a noisy diagnostic off or listing the i18n target
languages. A developer can override any of it in their own editor settings.
The file is read once at start, so restart the server after editing it.

```json
{
  "features": { "diagnostics.java": false },
  "i18n": { "languages": ["fr"] }
}
```

## When something is off

- **Nothing happens in the editor.** Confirm the workspace root holds `pom.js`.
  The server only starts for a FOAM project.
- **Completions never arrive, or the agent tools time out.** The boot may have
  failed. In VS Code, open the **FOAM Language Server** output channel. In
  Claude Code, run `/mcp` and read the `[foam-lsp]` lines. A broken `pom.js`
  stops model indexing.
- **A new class is not found.** The index reflects files on disk at start.
  Restart the server after adding a class file or a `pom.js` entry.
- **Changed a flag or `foam-lsp.json` and nothing changed.** Restart the
  server. VS Code: FOAM status bar item, **Restart FOAM LSP**. Agents: restart
  the agent.
- **Uninstall.** Remove the `foam-lsp` entry from the agent's config file, or
  uninstall the editor extension.

## More

- `foam3/tools/lsp/README.md`: features, architecture, i18n translation setup
- `foam3/tools/lsp/docs/IDE-INTEGRATION.md`: wiring any LSP client by hand
- `foam3/tools/lsp/editors/mcp/README.md`: the full MCP tool table
