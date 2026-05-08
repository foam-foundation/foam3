# FOAM3 Language Support — Zed

Zed extension providing code intelligence for FOAM3 model files via the
FOAM Language Server.

## Install

### Dev Extension (recommended)

1. Open Zed
2. Open Command Palette (`Cmd+Shift+P`)
3. Type `zed: extensions`
4. Click **Install Dev Extension**
5. Select the `foam3/tools/lsp/editors/zed-foam3/` directory

Zed compiles the Rust code to WASM automatically. The extension activates
for JavaScript files in any workspace.

Or run the guided install:

```bash
cd foam3/tools/lsp/editors/zed-foam3
./install.sh
```

### Prerequisites

- **Zed** IDE
- **Rust** installed via `rustup` (not Homebrew)
- **Node.js** 18+ (the FOAM LSP server runs on Node)
- A FOAM3 project with `pom.js` in the workspace root

## Features

All features come from the FOAM Language Server:

- Autocomplete (property types, class names, `this.` members, `.create({})` properties)
- Hover (class docs, method signatures, property types, Java block info)
- Go-to-definition (class source files, type definitions)
- Find references (subclasses, interface implementors)
- Diagnostics (unknown classes, wrong property types, Java import validation)
- Document symbols and workspace symbols
- Semantic tokens (resolved class references, typed variables)
- Code actions ("Did you mean X?", fix wrong imports)
- Folding ranges, signature help
- JRL (FOAM Journal) file support

## How It Works

The extension registers the FOAM LSP server with Zed. When you open a
JavaScript file, Zed spawns:

```
node foam3/tools/lsp-start.js
```

The server boots the full FOAM runtime (~10-15 seconds), then serves
language features over stdio JSON-RPC.

## Configuration

Override the server binary or arguments in your Zed settings
(`~/.config/zed/settings.json`):

```json
{
  "lsp": {
    "foam3-lsp": {
      "binary": {
        "path": "/usr/local/bin/node",
        "arguments": ["foam3/tools/lsp-start.js"]
      }
    }
  }
}
```

Defaults:
- `path`: `node` from PATH (detected via `worktree.which("node")`)
- `arguments`: `["foam3/tools/lsp-start.js"]`

### Java Syntax Highlighting in `javaCode:` Blocks

The extension provides a "FOAM JavaScript" language that includes Java syntax
highlighting for FOAM model properties like `javaCode:`, `javaFactory:`,
`javaPreSet:`, `javaPostSet:`, etc. To activate it:

1. **Install the Zed Java extension** (required for the Java grammar):
   - Open Command Palette (`Cmd+Shift+P`)
   - Type `zed: extensions`
   - Search for "Java" and install it

2. **Map `.js` files to FOAM JavaScript** in your Zed settings
   (`~/.config/zed/settings.json`):

```json
{
  "file_types": {
    "FOAM JavaScript": ["js", "jsx", "mjs", "cjs"]
  }
}
```

This tells Zed to use the "FOAM JavaScript" language (which includes all
standard JavaScript highlighting plus FOAM-specific Java injections) instead
of the built-in JavaScript for `.js` files. All other JavaScript features
(completions, indenting, bracket matching, JSX, etc.) work identically since
both languages share the same underlying TSX grammar.

To revert, remove the `file_types` entry.

**Supported FOAM properties with Java highlighting:**
`javaCode`, `javaFactory`, `javaGetter`, `javaSetter`, `javaPreSet`,
`javaPostSet`, `javaAdapt`, `javaValidateObj`, `javaCompare`,
`javaComparePropertyToObject`, `javaComparePropertyToValue`,
`javaAssertValue`, `javaCloneProperty`, `javaDiffProperty`,
`javaFromCSVLabelMapping`, `javaToCSV`, `javaToCSVLabel`, `javaFormatJSON`,
`javaValue`, `javaInfoType`, `javaType`, `javaJSONParser`,
`javaQueryParser`, `javaCSVParser`, `javaThrows`, `javaGenerate`

Both backtick template literals and quoted strings are supported.

You can also use the `/* java */` comment prefix on any template string:

```javascript
const query = /* java */ `SELECT * FROM users WHERE id = ?`;
```

## Project Structure

```
zed-foam3/
  extension.toml             # Zed extension manifest
  Cargo.toml                 # Rust WASM build configuration
  src/
    lib.rs                   # Extension entry point (~40 lines)
  languages/
    foam-javascript/         # FOAM JavaScript language (JS + Java injections)
      config.toml            # Language config (uses tsx grammar)
      injections.scm         # JS injections + FOAM Java property injections
      highlights.scm         # Syntax highlighting (copy of Zed JS)
      brackets.scm           # Bracket matching
      indents.scm            # Auto-indentation
      outline.scm            # Document outline
      overrides.scm          # Editor overrides (strings, JSX, etc.)
      runnables.scm          # Test runner support
      textobjects.scm        # Text object selection
      debugger.scm           # Debugger variable detection
    jrl/                     # FOAM Journal language
      config.toml            # Uses JSON grammar for .jrl files
      highlights.scm         # JSON-based highlighting
  install.sh                 # Guided installation helper
  README.md                  # This file
```

## Development

### Rebuild After Changes

After modifying `src/lib.rs`:

1. Uninstall the dev extension in Zed (Extensions → Installed → Uninstall)
2. Re-install via "Install Dev Extension" pointing to this directory
3. Zed recompiles the WASM automatically

### Debugging

Launch Zed from the terminal to see extension logs:

```bash
zed --foreground
```

`println!` and `eprintln!` output appears in the terminal.

### Testing

Open a FOAM project in Zed and verify:
- Completions appear when typing `class: '` inside a property
- Hover shows class documentation on `extends: 'foam.u2.Element'`
- Go-to-definition works on class names in `requires:`
- Diagnostics appear for unknown classes

## Known Limitations

- **Java highlighting requires opt-in** — Zed does not support augmenting
  built-in language queries from extensions (see [zed#8795]). The workaround
  is the "FOAM JavaScript" language, activated via `file_types` in settings.
  See the Configuration section above for setup.
- **Query files must stay in sync** — The FOAM JavaScript language copies
  Zed's built-in JavaScript query files (highlights.scm, brackets.scm, etc.).
  If Zed updates these files in a new release, the copies may need updating.

[zed#8795]: https://github.com/zed-industries/zed/issues/8795

## Troubleshooting

### Extension does not compile

- Verify Rust is installed via `rustup`: `rustup --version`
- Homebrew Rust (`brew install rust`) does not work with Zed extensions
- Check the terminal output when running Zed with `--foreground`

### No completions after opening a file

- Wait ~10-15 seconds for the FOAM runtime to boot
- Verify Node.js is in your PATH: `which node`
- Check that `pom.js` exists in the workspace root

### Server path not found

- The default `foam3/tools/lsp-start.js` is relative to the workspace root
- If your project structure differs, override via Zed settings (see Configuration)
