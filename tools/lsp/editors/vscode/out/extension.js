"use strict";
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const FoamTreeProvider_1 = require("./FoamTreeProvider");
const FoamAnalysisRunner_1 = require("./FoamAnalysisRunner");
let client;
function activate(context) {
    const outputChannel = vscode_1.window.createOutputChannel('FOAM Language Server');
    context.subscriptions.push(outputChannel);
    outputChannel.appendLine('FOAM LSP extension activated');
    const folders = vscode_1.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return;
    // Search all workspace folders and one level of subdirectories for lsp-start.js
    const lspPaths = ['foam3/tools/lsp-start.js', 'tools/lsp-start.js'];
    let lspScript = '';
    let workspaceRoot = folders[0].uri.fsPath;
    for (const folder of folders) {
        const root = folder.uri.fsPath;
        // Check the folder itself
        for (const rel of lspPaths) {
            const candidate = path.join(root, rel);
            if (fs.existsSync(candidate)) {
                lspScript = candidate;
                workspaceRoot = root;
                break;
            }
        }
        if (lspScript)
            break;
        // Check immediate subdirectories (handles opening the parent directory)
        try {
            const entries = fs.readdirSync(root, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory() || entry.name.startsWith('.'))
                    continue;
                for (const rel of lspPaths) {
                    const candidate = path.join(root, entry.name, rel);
                    if (fs.existsSync(candidate)) {
                        lspScript = candidate;
                        workspaceRoot = path.join(root, entry.name);
                        break;
                    }
                }
                if (lspScript)
                    break;
            }
        }
        catch (e) { /* ignore permission errors */ }
        if (lspScript)
            break;
    }
    if (!lspScript) {
        outputChannel.appendLine('Not a FOAM project (lsp-start.js not found)');
        outputChannel.appendLine('Searched: ' + folders.map(f => f.uri.fsPath).join(', '));
        return;
    }
    outputChannel.appendLine('Workspace: ' + workspaceRoot);
    let pomPath = path.join(workspaceRoot, 'pom');
    if (!fs.existsSync(pomPath + '.js')) {
        pomPath = path.join(path.dirname(path.dirname(lspScript)), 'pom');
    }
    outputChannel.appendLine('LSP: ' + lspScript);
    outputChannel.appendLine('POM: ' + pomPath);
    // Register sidebar tree view
    const treeProvider = new FoamTreeProvider_1.FoamTreeProvider();
    const treeView = vscode_1.window.createTreeView('foamAnalysis', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);
    // Register analyze command (runner set up after client starts)
    let runner = null;
    context.subscriptions.push(vscode_1.commands.registerCommand('foam.analyzeWorkspace', async () => {
        if (!runner) {
            vscode_1.window.showWarningMessage('FOAM LSP server not ready yet.');
            return;
        }
        try {
            await runner.run();
            vscode_1.window.showInformationMessage('FOAM workspace analysis complete.');
        }
        catch (e) {
            vscode_1.window.showErrorMessage('FOAM analysis failed: ' + e.message);
        }
    }));
    // Register flag toggle command
    const flagState = {
        js: true, java: true, web: true, debug: true,
        test: false, node: false, swift: false
    };
    context.subscriptions.push(vscode_1.commands.registerCommand('foam.toggleFlag', (flagName) => {
        flagState[flagName] = !flagState[flagName];
        treeProvider.setActiveFlags(flagState);
        vscode_1.window.showInformationMessage(`FOAM flag "${flagName}" is now ${flagState[flagName] ? 'ON' : 'OFF'}. ` +
            `Restart LSP (Cmd+Shift+P → "FOAM: Restart") to apply.`);
    }));
    // Defer server start to not block activation
    setTimeout(() => {
        startServer(context, outputChannel, lspScript, pomPath, workspaceRoot, treeProvider, (r) => { runner = r; });
    }, 100);
}
function startServer(context, outputChannel, lspScript, pomPath, cwd, treeProvider, onRunnerReady) {
    // GUI-launched VS Code does not inherit the shell PATH, so a bare `node`
    // command fails with ENOENT when Node lives under nvm or homebrew. Default to
    // the Node binary bundled with VS Code (run via ELECTRON_RUN_AS_NODE); honour
    // an explicit foam.nodePath override when the user sets one.
    const configuredNode = (vscode_1.workspace.getConfiguration('foam').get('nodePath') || '').trim();
    const env = { ...process.env };
    if (!configuredNode)
        env.ELECTRON_RUN_AS_NODE = '1';
    const serverOptions = {
        command: configuredNode || process.execPath,
        args: [lspScript, pomPath],
        options: { cwd, env }
    };
    const clientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'foam-journal' }
        ],
        synchronize: {
            fileEvents: [
                vscode_1.workspace.createFileSystemWatcher('**/*.js'),
                vscode_1.workspace.createFileSystemWatcher('**/*.jrl'),
                vscode_1.workspace.createFileSystemWatcher('**/pom.js')
            ]
        },
        outputChannel: outputChannel
    };
    client = new node_1.LanguageClient('foam-lsp', 'FOAM Language Server', serverOptions, clientOptions);
    const status = vscode_1.window.createStatusBarItem();
    status.text = '$(loading~spin) FOAM: Indexing...';
    status.show();
    outputChannel.appendLine('Starting FOAM LSP server...');
    client.start().then(() => {
        outputChannel.appendLine('FOAM LSP server ready');
        status.text = '$(check) FOAM: Ready';
        setTimeout(() => status.hide(), 5000);
        // Set up analysis runner now that client is ready
        const runner = new FoamAnalysisRunner_1.FoamAnalysisRunner(client, treeProvider);
        onRunnerReady(runner);
        // Handle progress notifications from workspace analysis
        client.onNotification('foam/analyzeProgress', (params) => {
            runner.handleProgress(params);
        });
        // Auto-run workspace analysis on startup (after a short delay for boot to settle)
        setTimeout(async () => {
            outputChannel.appendLine('Auto-running workspace analysis...');
            try {
                await runner.run();
                outputChannel.appendLine('Startup analysis complete.');
            }
            catch (e) {
                outputChannel.appendLine('Startup analysis failed: ' + e.message);
            }
        }, 2000);
    }).catch((err) => {
        outputChannel.appendLine('FOAM LSP failed: ' + err.message);
        status.text = '$(error) FOAM: Error';
    });
    context.subscriptions.push(client);
}
function deactivate() {
    if (!client)
        return undefined;
    return client.stop();
}
//# sourceMappingURL=extension.js.map