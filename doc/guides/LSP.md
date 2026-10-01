# FOAM LSP

The FOAM language server lives in its own repo:
https://github.com/foam-foundation/FOAM-LSP

Install it from any foam3 or app checkout with `./build.sh lsp-install[:editor]`.
Builds keep it current; `--lsp-auto-update:false` turns that off and is saved
until `--lsp-auto-update:true`.
