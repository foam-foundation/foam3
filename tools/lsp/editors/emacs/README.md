# FOAM3 Language Support — Emacs

Emacs integration for the FOAM Language Server, supporting both **eglot**
(built-in since Emacs 29) and **lsp-mode**.

## Quick Start

### eglot (recommended, zero dependencies)

Add to your `init.el`:

```elisp
(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               '((js-mode js-ts-mode)
                 . ("node" "/path/to/foam3/tools/lsp-start.js"))))
```

Open a FOAM `.js` file and run `M-x eglot`. Done.

To auto-start in FOAM projects:

```elisp
(add-hook 'js-mode-hook
          (lambda ()
            (when (locate-dominating-file default-directory "pom.js")
              (eglot-ensure))))
```

### lsp-mode

Run the install script:

```bash
cd foam3/tools/lsp/editors/emacs
./install.sh
```

This copies `lsp-foam.el` to `~/.emacs.d/site-lisp/` and prints the config
snippet to add. Or configure manually:

```elisp
(add-to-list 'load-path "~/.emacs.d/site-lisp")
(require 'lsp-foam)
(add-hook 'js-mode-hook #'lsp-deferred)
```

With `use-package`:

```elisp
(use-package lsp-foam
  :load-path "~/.emacs.d/site-lisp"
  :custom
  (lsp-foam-server-command '("node" "/path/to/foam3/tools/lsp-start.js")))
```

## Features

All features come from the FOAM Language Server — both eglot and lsp-mode
receive the same capabilities:

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

The FOAM LSP server communicates over stdio using JSON-RPC 2.0. Emacs spawns
the server as a child process:

```
node foam3/tools/lsp-start.js [pom-path]
```

The server boots the full FOAM runtime (~10-15 seconds), loading all model
definitions into memory for rich code intelligence.

## eglot vs lsp-mode

| | eglot | lsp-mode |
|---|---|---|
| **Built-in** | Yes (Emacs 29+) | No (requires package) |
| **Dependencies** | None | lsp-mode, lsp-ui (optional) |
| **Config** | 3 lines | 3 lines + `lsp-foam.el` |
| **UI extras** | Minimal | Breadcrumbs, lens, sideline |
| **Performance** | Lightweight | More features, more overhead |

Both work well. Use eglot for simplicity, lsp-mode if you want the extra UI.

## Customization (lsp-mode)

| Variable | Default | Description |
|---|---|---|
| `lsp-foam-server-command` | `("node" "foam3/tools/lsp-start.js")` | Server start command |
| `lsp-foam-server-args` | `()` | Extra args (e.g., POM path) |

## Project-Local Activation

Add a `.dir-locals.el` to your FOAM project root for automatic activation:

```elisp
;; For eglot:
((js-mode . ((eval . (eglot-ensure)))))

;; For lsp-mode:
((js-mode . ((eval . (lsp-deferred)))))
```

This activates the LSP for all JavaScript files within the project directory.

## Troubleshooting

### Server does not start

- Check Node.js is installed: `M-x shell-command RET node --version`
- Verify the path in your config points to `lsp-start.js`
- Check `*FOAM Language Server*` buffer (lsp-mode) or `*eglot*` buffer for errors

### No completions after opening a file

- Wait ~10-15 seconds for the server to boot
- Verify the file contains `foam.CLASS(`, `foam.ENUM(`, or `foam.INTERFACE(`
- Check `pom.js` exists in the project root

### eglot does not activate

- Verify your Emacs version: `M-x emacs-version` (requires 29+)
- Check `eglot-server-programs` has the FOAM entry: `M-x describe-variable RET eglot-server-programs`

## Requirements

- Emacs 27.1+ (for lsp-mode) or Emacs 29+ (for eglot)
- Node.js 18+
- A FOAM3 project with `pom.js` in the root
- lsp-mode 8.0+ (only if using lsp-mode)
