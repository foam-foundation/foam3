/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import * as path from 'path';
import * as fs from 'fs';
import { ExtensionContext, workspace, window, commands } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient/node';
import { FoamTreeProvider } from './FoamTreeProvider';
import { FoamAnalysisRunner } from './FoamAnalysisRunner';

let client: LanguageClient;

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
  const serverOptions: ServerOptions = {
    command: 'node',
    args: [lspScript, pomPath],
    options: { cwd }
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
    outputChannel: outputChannel as any
  };

  client = new LanguageClient('foam-lsp', 'FOAM Language Server', serverOptions, clientOptions);

  const status = window.createStatusBarItem();
  status.text = '$(loading~spin) FOAM: Indexing...';
  status.show();

  outputChannel.appendLine('Starting FOAM LSP server...');

  client.start().then(() => {
    outputChannel.appendLine('FOAM LSP server ready');
    status.text = '$(check) FOAM: Ready';
    setTimeout(() => status.hide(), 5000);

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

  context.subscriptions.push(client);
}

export function deactivate(): Thenable<void> | undefined {
  if ( !client ) return undefined;
  return client.stop();
}
