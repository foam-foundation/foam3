/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import * as vscode from 'vscode';

export interface AnalysisResults {
  filesScanned: number;
  filesWithIssues: number;
  warnings: number;
  errors: number;
  infos: number;
  patterns: Array<{ pattern: string; count: number; severity: number }>;
  fileResults?: Record<string, Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    severity: number;
    message: string;
  }>>;
}

class FoamTreeItem extends vscode.TreeItem {
  children: FoamTreeItem[];
  fileUri?: string;
  fileLine?: number;

  constructor(
    label: string,
    collapsible: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsible);
    this.children = [];
  }
}

export class FoamTreeProvider implements vscode.TreeDataProvider<FoamTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FoamTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private results: AnalysisResults | null = null;
  private running = false;
  private lastRunTime: string | null = null;
  private serverInfo: { classes: number; files: number; types: number } | null = null;
  private activeFlags: Record<string, boolean> = {
    js: true, java: true, web: true, debug: true,
    test: false, node: false, swift: false
  };

  // Cache the root items so children work on expand
  private rootCache: FoamTreeItem[] = [];

  getTreeItem(element: FoamTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FoamTreeItem): FoamTreeItem[] {
    if ( !element ) {
      this.rootCache = this.buildRootItems();
      return this.rootCache;
    }
    return element.children || [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.refresh();
  }

  setResults(results: AnalysisResults): void {
    this.results = results;
    this.lastRunTime = new Date().toLocaleTimeString();
    this.running = false;
    this.refresh();
  }

  setServerInfo(info: { classes: number; files: number; types: number }): void {
    this.serverInfo = info;
    this.refresh();
  }

  setActiveFlags(flags: Record<string, boolean>): void {
    this.activeFlags = flags;
    this.refresh();
  }

  private buildRootItems(): FoamTreeItem[] {
    const items: FoamTreeItem[] = [];

    // Analysis section
    const analysis = new FoamTreeItem('Analysis', vscode.TreeItemCollapsibleState.Expanded);
    analysis.iconPath = new vscode.ThemeIcon('graph');
    analysis.children = this.buildAnalysisChildren();
    items.push(analysis);

    // Files with issues
    if ( this.results && this.results.fileResults ) {
      const fileCount = Object.keys(this.results.fileResults).length;
      if ( fileCount > 0 ) {
        const files = new FoamTreeItem(
          `Files with Issues (${fileCount})`,
          vscode.TreeItemCollapsibleState.Collapsed
        );
        files.iconPath = new vscode.ThemeIcon('folder');
        files.children = this.buildFileChildren();
        items.push(files);
      }
    }

    // Patterns
    if ( this.results && this.results.patterns && this.results.patterns.length > 0 ) {
      const patterns = new FoamTreeItem(
        `Patterns (${this.results.patterns.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      patterns.iconPath = new vscode.ThemeIcon('search');
      patterns.children = this.buildPatternChildren();
      items.push(patterns);
    }

    // Active flags
    const flags = new FoamTreeItem('Active Flags', vscode.TreeItemCollapsibleState.Collapsed);
    flags.iconPath = new vscode.ThemeIcon('settings-gear');
    flags.children = this.buildFlagsChildren();
    items.push(flags);

    // Server info
    if ( this.serverInfo ) {
      const info = new FoamTreeItem('Server Info', vscode.TreeItemCollapsibleState.Collapsed);
      info.iconPath = new vscode.ThemeIcon('gear');
      info.children = [
        this.makeStatItem('Classes indexed: ' + this.serverInfo.classes, 'symbol-class'),
        this.makeStatItem('Files indexed: ' + this.serverInfo.files, 'files'),
        this.makeStatItem('Property types: ' + this.serverInfo.types, 'symbol-property')
      ];
      items.push(info);
    }

    return items;
  }

  private buildAnalysisChildren(): FoamTreeItem[] {
    const children: FoamTreeItem[] = [];

    if ( this.running ) {
      const item = new FoamTreeItem('Running analysis...');
      item.iconPath = new vscode.ThemeIcon('loading~spin');
      children.push(item);
      return children;
    }

    // Run button
    const run = new FoamTreeItem('Run Workspace Analysis');
    run.iconPath = new vscode.ThemeIcon('play');
    run.command = { command: 'foam.analyzeWorkspace', title: 'Run Analysis' };
    children.push(run);

    if ( this.lastRunTime ) {
      children.push(this.makeStatItem('Last run: ' + this.lastRunTime, 'clock'));
    }

    if ( this.results ) {
      children.push(this.makeStatItem('Files: ' + this.results.filesScanned + ' scanned', 'files'));

      const warn = this.makeStatItem('Warnings: ' + this.results.warnings, 'warning');
      warn.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      children.push(warn);

      children.push(this.makeStatItem('Info: ' + this.results.infos, 'info'));

      const err = this.makeStatItem('Errors: ' + this.results.errors, 'error');
      err.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
      children.push(err);
    }

    return children;
  }

  private buildFileChildren(): FoamTreeItem[] {
    if ( !this.results || !this.results.fileResults ) return [];
    const children: FoamTreeItem[] = [];
    const fileResults = this.results.fileResults;

    const uris = Object.keys(fileResults).sort((a, b) => {
      return (fileResults[b]?.length || 0) - (fileResults[a]?.length || 0);
    });

    for ( let i = 0 ; i < Math.min(uris.length, 100) ; i++ ) {
      const uri = uris[i];
      const diags = fileResults[uri];
      if ( !diags || diags.length === 0 ) continue;

      const fileName = uri.split('/').pop() || uri;

      const file = new FoamTreeItem(
        `${fileName} (${diags.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      file.iconPath = new vscode.ThemeIcon('file');
      file.children = [];

      for ( let d = 0 ; d < Math.min(diags.length, 30) ; d++ ) {
        const diag = diags[d];
        const iconName = diag.severity === 1 ? 'error' : diag.severity === 2 ? 'warning' : 'info';
        const entry = new FoamTreeItem(diag.message);
        entry.iconPath = new vscode.ThemeIcon(iconName);
        entry.description = `Ln ${diag.range.start.line + 1}`;
        entry.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [
            vscode.Uri.parse(uri),
            {
              selection: new vscode.Range(
                diag.range.start.line, diag.range.start.character,
                diag.range.end.line, diag.range.end.character
              )
            }
          ]
        };
        file.children.push(entry);
      }

      children.push(file);
    }

    return children;
  }

  private buildPatternChildren(): FoamTreeItem[] {
    if ( !this.results || !this.results.patterns ) return [];
    const children: FoamTreeItem[] = [];

    const sorted = [...this.results.patterns].sort((a, b) => b.count - a.count);

    for ( let i = 0 ; i < Math.min(sorted.length, 50) ; i++ ) {
      const p = sorted[i];
      const iconName = p.severity === 1 ? 'error' : p.severity === 2 ? 'warning' : 'info';
      const item = new FoamTreeItem(p.pattern);
      item.iconPath = new vscode.ThemeIcon(iconName);
      item.description = `${p.count}x`;
      children.push(item);
    }

    return children;
  }

  private buildFlagsChildren(): FoamTreeItem[] {
    const children: FoamTreeItem[] = [];
    const flagNames = ['js', 'java', 'web', 'test', 'node', 'swift', 'debug'];

    for ( const name of flagNames ) {
      const active = this.activeFlags[name] !== false;
      const item = new FoamTreeItem(name + (active ? ' (active)' : ' (off)'));
      item.iconPath = new vscode.ThemeIcon(active ? 'check' : 'circle-outline');
      item.tooltip = active
        ? `Flag "${name}" is ON — click to disable (requires LSP restart)`
        : `Flag "${name}" is OFF — click to enable (requires LSP restart)`;
      item.command = { command: 'foam.toggleFlag', title: 'Toggle Flag', arguments: [name] };
      children.push(item);
    }

    return children;
  }

  private makeStatItem(label: string, icon: string): FoamTreeItem {
    const item = new FoamTreeItem(label);
    item.iconPath = new vscode.ThemeIcon(icon);
    return item;
  }
}
