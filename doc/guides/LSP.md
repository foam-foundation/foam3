# FOAM LSP

The FOAM language server lives in its own repo:
https://github.com/foam-foundation/FOAM-LSP

```bash
./build.sh lsp-install:<editor>       # clone it into ~/.foam/lsp and set up an editor or MCP agent
./build.sh lsp-auto-update:false      # stop builds updating the clone (saved)
./build.sh lsp-auto-update:true       # turn it back on
./build.sh lsp-update                 # update by hand
```

An editor set up before the move still points at `foam3/tools/lsp-start.js`; run `./build.sh lsp-install:<editor>` again to repoint it.
