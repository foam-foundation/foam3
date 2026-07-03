use zed_extension_api::{self as zed, settings::LspSettings, Command, LanguageServerId, Result, Worktree};

struct Foam3Extension;

impl zed::Extension for Foam3Extension {
    fn new() -> Self {
        Foam3Extension
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &Worktree,
    ) -> Result<Command> {
        // Allow users to override the binary path via Zed settings:
        //   "lsp": { "foam3-lsp": { "binary": { "path": "/usr/local/bin/node", "arguments": [...] } } }
        let settings = LspSettings::for_worktree(language_server_id.as_ref(), worktree).ok();

        let node_path = settings
            .as_ref()
            .and_then(|s| s.binary.as_ref())
            .and_then(|b| b.path.clone())
            .or_else(|| worktree.which("node"))
            .unwrap_or_else(|| "node".to_string());

        // Path is relative to workspace root. Assumes foam3 is a subdirectory
        // (e.g., as a git submodule). If opening the foam3 repo directly,
        // override via Zed settings: lsp.foam3-lsp.binary.arguments
        let default_args = vec!["foam3/tools/lsp-start.js".to_string()];

        let args = settings
            .as_ref()
            .and_then(|s| s.binary.as_ref())
            .and_then(|b| b.arguments.clone())
            .unwrap_or(default_args);

        Ok(Command {
            command: node_path,
            args,
            env: Default::default(),
        })
    }
}

zed::register_extension!(Foam3Extension);
