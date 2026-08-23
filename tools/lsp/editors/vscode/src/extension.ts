/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import * as path from 'path';
import * as fs from 'fs';
import { ExtensionContext, workspace, window, commands, Uri, StatusBarItem, RelativePattern } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient/node';
import { FoamTreeProvider } from './FoamTreeProvider';
import { FoamAnalysisRunner } from './FoamAnalysisRunner';

let client: LanguageClient;

// Mirrors FeatureConfig.DEFAULTS keys (tools/lsp/FeatureConfig.js:23-33) — the
// package.json setting ids under foam.features.* MUST match these exactly.
const FLAG_KEYS = [
  'diagnostics.java',
  'diagnostics.i18n',
  'hints.i18nMissingLanguage',
  'completion',
  'hover',
  'semanticTokens',
  'signatureHelp',
  'folding',
  'codeLens.i18n',
  'codeLens.hierarchy'
];

// Forwards only EXPLICITLY-set foam.* settings to the server as
// initializationOptions. A value left at its package.json default is not
// sent at all, so the server's own FeatureConfig.DEFAULTS (and foam-lsp.json)
// stay authoritative for anyone who never touched the setting — only a user
// who actually opened Settings and changed something overrides them.
function explicitFoamSettings(): any {
  const cfg = workspace.getConfiguration('foam');
  const features: Record<string, boolean> = {};
  for ( const key of FLAG_KEYS ) {
    const info = cfg.inspect<boolean>('features.' + key);
    const v = info?.workspaceFolderValue ?? info?.workspaceValue ?? info?.globalValue;
    if ( v !== undefined ) features[key] = v;
  }

  const i18n: Record<string, unknown> = {};
  for ( const key of ['languages', 'endpoint', 'model', 'sourceLanguage'] ) {
    const info = cfg.inspect<unknown>('i18n.' + key);
    const v = info?.workspaceFolderValue ?? info?.workspaceValue ?? info?.globalValue;
    if ( v !== undefined ) i18n[key] = v;
  }

  return { foam: { features: features, i18n: i18n } };
}

export function activate(context: ExtensionContext) {
  const outputChannel = window.createOutputChannel('FOAM Language Server');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('FOAM LSP extension activated');

  const folders = workspace.workspaceFolders;
  if ( !folders || folders.length === 0 ) return;

  // Search all workspace folders and one level of subdirectories for lsp-start.js
  const lspPaths = ['foam3/tools/lsp-start.js', 'tools/lsp-start.js'];
  let lspScript = '';
  let workspaceRoot = folders[0].uri.fsPath;

  for ( const folder of folders ) {
    const root = folder.uri.fsPath;
    // Check the folder itself
    for ( const rel of lspPaths ) {
      const candidate = path.join(root, rel);
      if ( fs.existsSync(candidate) ) {
        lspScript = candidate;
        workspaceRoot = root;
        break;
      }
    }
    if ( lspScript ) break;

    // Check immediate subdirectories (handles opening the parent directory)
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for ( const entry of entries ) {
        if ( !entry.isDirectory() || entry.name.startsWith('.') ) continue;
        for ( const rel of lspPaths ) {
          const candidate = path.join(root, entry.name, rel);
          if ( fs.existsSync(candidate) ) {
            lspScript = candidate;
            workspaceRoot = path.join(root, entry.name);
            break;
          }
        }
        if ( lspScript ) break;
      }
    } catch (e) { /* ignore permission errors */ }
    if ( lspScript ) break;
  }

  if ( !lspScript ) {
    outputChannel.appendLine('Not a FOAM project (lsp-start.js not found)');
    outputChannel.appendLine('Searched: ' + folders.map(f => f.uri.fsPath).join(', '));
    return;
  }

  outputChannel.appendLine('Workspace: ' + workspaceRoot);

  let pomPath = path.join(workspaceRoot, 'pom');
  if ( !fs.existsSync(pomPath + '.js') ) {
    pomPath = path.join(path.dirname(path.dirname(lspScript)), 'pom');
  }

  outputChannel.appendLine('LSP: ' + lspScript);
  outputChannel.appendLine('POM: ' + pomPath);

  // Register sidebar tree view
  const treeProvider = new FoamTreeProvider();
  const treeView = window.createTreeView('foamAnalysis', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Register analyze command (runner set up after client starts)
  let runner: FoamAnalysisRunner | null = null;

  context.subscriptions.push(
    commands.registerCommand('foam.analyzeWorkspace', async () => {
      if ( !runner ) {
        window.showWarningMessage('FOAM LSP server not ready yet.');
        return;
      }
      try {
        await runner.run();
        window.showInformationMessage('FOAM workspace analysis complete.');
      } catch (e: any) {
        window.showErrorMessage('FOAM analysis failed: ' + e.message);
      }
    })
  );

  // Register flag toggle command
  const flagState: Record<string, boolean> = {
    js: true, java: true, web: true, debug: true,
    test: false, node: false, swift: false
  };

  context.subscriptions.push(
    commands.registerCommand('foam.toggleFlag', (flagName: string) => {
      flagState[flagName] = !flagState[flagName];
      treeProvider.setActiveFlags(flagState);
      window.showInformationMessage(
        `FOAM flag "${flagName}" is now ${flagState[flagName] ? 'ON' : 'OFF'}. ` +
        `Restart LSP (Cmd+Shift+P → "FOAM: Restart") to apply.`
      );
    })
  );

  // Register "FOAM: New Class" — prompts for a name, resolves a target
  // folder, then hands off to the server's foam.scaffold.newClass command.
  // The server builds the WorkspaceEdit (new file + pom.js registration);
  // this command only prompts, sends the request, and reacts to the result.
  context.subscriptions.push(
    commands.registerCommand('foam.newClass', async () => {
      if ( !client ) {
        window.showWarningMessage('FOAM LSP server not ready yet.');
        return;
      }

      const name = await window.showInputBox({
        prompt: 'FOAM class name',
        placeHolder: 'MyNewClass',
        validateInput: (v: string) =>
          /^[A-Z][A-Za-z0-9]*$/.test(v) ?
            null :
            'Must start with an uppercase letter and contain only letters and digits.'
      });
      if ( !name ) return;

      let dir: string | undefined;
      const activeUri = window.activeTextEditor?.document.uri;
      if ( activeUri && activeUri.scheme === 'file' ) {
        dir = path.dirname(activeUri.fsPath);
      } else {
        const wsFolders = workspace.workspaceFolders;
        if ( !wsFolders || wsFolders.length === 0 ) {
          window.showWarningMessage('No workspace folder open.');
          return;
        }
        if ( wsFolders.length === 1 ) {
          dir = wsFolders[0].uri.fsPath;
        } else {
          const picked = await window.showWorkspaceFolderPick();
          if ( !picked ) return;
          dir = picked.uri.fsPath;
        }
      }

      try {
        const response: any = await client.sendRequest('workspace/executeCommand', {
          command: 'foam.scaffold.newClass',
          arguments: [{ dir, name }]
        });
        // A failure response is null — the reason already arrived as a
        // window/showMessage error from the server, nothing more to do here.
        if ( !response ) return;
        if ( response.warning ) {
          window.showWarningMessage('FOAM: New Class — ' + response.warning);
        }
        if ( response.created ) {
          const doc = await workspace.openTextDocument(Uri.parse(response.created));
          await window.showTextDocument(doc);
        }
      } catch (e: any) {
        window.showErrorMessage('FOAM: New Class failed: ' + e.message);
      }
    })
  );

  // Defer server start to not block activation
  setTimeout(() => {
    startServer(context, outputChannel, lspScript, pomPath, workspaceRoot, treeProvider, (r) => { runner = r; });
  }, 100);
}

function startServer(
  context: ExtensionContext,
  outputChannel: any,
  lspScript: string,
  pomPath: string,
  cwd: string,
  treeProvider: FoamTreeProvider,
  onRunnerReady: (runner: FoamAnalysisRunner) => void
) {
  const status: StatusBarItem = window.createStatusBarItem();
  status.text = '$(loading~spin) FOAM: Indexing...';
  status.command = 'foam.showStatusMenu';
  status.show();
  context.subscriptions.push(status);

  // Quick-pick menu bound to the status bar item — offers the two actions
  // that matter once the server is running: restart it, or look at its log.
  // Registered once here (startServer runs exactly once, from activate's
  // deferred setTimeout below) so restarting the CLIENT never re-registers
  // this command.
  context.subscriptions.push(
    commands.registerCommand('foam.showStatusMenu', async () => {
      const pick = await window.showQuickPick(
        ['Restart FOAM LSP', 'Show Output'],
        { placeHolder: 'FOAM Language Server' }
      );
      if ( pick === 'Restart FOAM LSP' ) {
        outputChannel.appendLine('Restarting FOAM LSP server...');
        status.text = '$(loading~spin) FOAM: Indexing...';
        try {
          if ( client ) await client.stop();
        } catch (e: any) {
          outputChannel.appendLine('Error stopping FOAM LSP: ' + e.message);
        }
        startClient();
      } else if ( pick === 'Show Output' ) {
        outputChannel.show();
      }
    })
  );

  // Builds and starts the LanguageClient. Split out from the one-time setup
  // above so "Restart FOAM LSP" can call it again without recreating the
  // status bar item or re-registering commands.
  function startClient() {
    // GUI-launched VS Code does not inherit the shell PATH, so a bare `node`
    // command fails with ENOENT when Node lives under nvm or homebrew. Default to
    // the Node binary bundled with VS Code (run via ELECTRON_RUN_AS_NODE); honour
    // an explicit foam.nodePath override when the user sets one.
    const configuredNode = (workspace.getConfiguration('foam').get<string>('nodePath') || '').trim();
    const env = { ...process.env };
    if ( ! configuredNode ) env.ELECTRON_RUN_AS_NODE = '1';
    const serverOptions: ServerOptions = {
      command: configuredNode || process.execPath,
      args: [lspScript, pomPath],
      options: { cwd, env }
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'foam-journal' }
      ],
      synchronize: {
        fileEvents: [
          workspace.createFileSystemWatcher('**/*.js'),
          workspace.createFileSystemWatcher('**/*.jrl'),
          workspace.createFileSystemWatcher('**/pom.js')
        ]
      },
      outputChannel: outputChannel as any,
      initializationOptions: explicitFoamSettings()
    };

    client = new LanguageClient('foam-lsp', 'FOAM Language Server', serverOptions, clientOptions);
    context.subscriptions.push(client);

    status.text = '$(loading~spin) FOAM: Indexing...';
    status.show();

    outputChannel.appendLine('Starting FOAM LSP server...');

    client.start().then(() => {
      outputChannel.appendLine('FOAM LSP server ready');
      status.text = '$(check) FOAM: Ready';

      // One-shot i18n status probe — appends the active translation model
      // name to the status bar when a provider is available. Fire-and-forget:
      // a failed/absent provider just leaves the plain "Ready" text.
      client.sendRequest('foam/i18nStatus', {}).then((s: any) => {
        if ( s && s.available && s.model ) {
          status.text = '$(check) FOAM: Ready · ' + s.model;
        }
      }, () => { /* no provider — status stays plain "Ready" */ });

      // Set up analysis runner now that client is ready
      const runner = new FoamAnalysisRunner(client, treeProvider);
      onRunnerReady(runner);

      // Handle progress notifications from workspace analysis
      client.onNotification('foam/analyzeProgress', (params: any) => {
        runner.handleProgress(params);
      });

      // Auto-run workspace analysis on startup (after a short delay for boot to settle)
      setTimeout(async () => {
        outputChannel.appendLine('Auto-running workspace analysis...');
        try {
          await runner.run();
          outputChannel.appendLine('Startup analysis complete.');
        } catch (e: any) {
          outputChannel.appendLine('Startup analysis failed: ' + e.message);
        }
      }, 2000);
    }).catch((err: Error) => {
      outputChannel.appendLine('FOAM LSP failed: ' + err.message);
      status.text = '$(error) FOAM: Error';
    });
  }

  // Restart plumbing shared with the manual quick-pick above: auto-restart
  // when the server's own source changes on disk. The server runs from the
  // workspace (tools/lsp/**), not from the VSIX, so a pulled or edited
  // handler would otherwise keep serving stale behavior until the whole
  // window reloads.
  async function autoRestartServer(reason: string) {
    outputChannel.appendLine('Restarting FOAM LSP (' + reason + ')');
    status.text = '$(loading~spin) FOAM: Indexing...';
    try {
      if ( client ) await client.stop();
    } catch (e: any) {
      outputChannel.appendLine('Error stopping FOAM LSP: ' + e.message);
    }
    startClient();
  }

  context.subscriptions.push(
    commands.registerCommand('foam.restartServer', () => autoRestartServer('manual'))
  );

  const serverWatcher = workspace.createFileSystemWatcher(
    new RelativePattern(path.join(path.dirname(lspScript), 'lsp'), '**/*.js')
  );
  // Debounce: a pull or multi-file save fires many events — restart once.
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRestart = (uri: { fsPath: string }) => {
    if ( restartTimer ) clearTimeout(restartTimer);
    restartTimer = setTimeout(
      () => autoRestartServer('changed: ' + path.basename(uri.fsPath)), 1500);
  };
  serverWatcher.onDidChange(scheduleRestart);
  serverWatcher.onDidCreate(scheduleRestart);
  serverWatcher.onDidDelete(scheduleRestart);
  context.subscriptions.push(serverWatcher);

  startClient();
}

export function deactivate(): Thenable<void> | undefined {
  if ( !client ) return undefined;
  return client.stop();
}
