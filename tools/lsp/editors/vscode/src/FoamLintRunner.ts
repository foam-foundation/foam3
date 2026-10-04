/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import {
  Diagnostic, DiagnosticCollection, DiagnosticSeverity, Range, Uri,
  languages, workspace
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { FoamTreeProvider } from './FoamTreeProvider';
import { LintFinding, groupByFile, scopeFindings, toDiagnosticData } from './lintModel';

// Registration-completeness findings, in their own DiagnosticCollection rather
// than merged into the server's analyzeWorkspace push: publishDiagnostics
// replaces a URI's whole diagnostic array, and lint needs its own refresh
// cadence and its own on/off switches.
export class FoamLintRunner {
  private client: LanguageClient;
  private treeProvider: FoamTreeProvider;
  private collection: DiagnosticCollection;
  private cache: LintFinding[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPushed: LintFinding[] | null = null;
  private disposed = false;

  constructor(client: LanguageClient, treeProvider: FoamTreeProvider) {
    this.client = client;
    this.treeProvider = treeProvider;
    this.collection = languages.createDiagnosticCollection('foam-lint');
  }

  dispose(): void {
    this.disposed = true;
    if ( this.timer ) clearTimeout(this.timer);
    this.collection.dispose();
  }

  /** Ask the server for findings, cache them, repaint. */
  async run(): Promise<void> {
    const cfg = workspace.getConfiguration('foam.lint');
    const checks = cfg.get<string[]>('checks', []);
    // An empty `checks` list means "run every check" to the LSP, which is the
    // opposite of what a user who unticked them all wants.
    if ( ! cfg.get<boolean>('enable', true) || checks.length === 0 ) {
      this.clear();
      return;
    }

    const result = await this.client.sendRequest<{ findings: LintFinding[] }>('foam/lint', {
      checks:          checks,
      strategyTargets: cfg.get<string[]>('strategyTargets', [])
    });
    this.cache = ( result && result.findings ) || [];
    this.render();
  }

  /** Coalesce bursts of saves into one lint pass (a full pass is ~0.7s). */
  runDebounced(ms: number = 1000): void {
    if ( this.timer ) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run().catch(() => {
        // Intentionally silent: a background pass should not nag. A failure here
        // leaves the previous findings painted — run "FOAM: Lint Registrations"
        // to see the error.
      });
    }, ms);
  }

  /** Repaint from the cache — no server round trip. */
  render(): void {
    if ( this.disposed ) return;
    const scope = workspace.getConfiguration('foam.lint').get<string>('scope', 'openFiles');
    // Normalize both sides through Uri.file(...).fsPath before comparing: the
    // LSP's finding paths and VS Code's document.uri.fsPath aren't guaranteed
    // to already agree on separators/casing/trailing form, and scopeFindings
    // matches by exact string equality — any mismatch silently drops every
    // finding with no error. this.cache itself stays un-normalized so the
    // tree (Task 3) still shows the server's own paths.
    const norm = (p: string): string => Uri.file(p).fsPath;
    const openPaths = workspace.textDocuments.map(d => norm(d.uri.fsPath));
    const visible = scopeFindings(this.cache.map(f => ({ ...f, path: norm(f.path) })), scope, openPaths);

    this.collection.clear();
    groupByFile(visible).forEach((findings, file) => {
      this.collection.set(Uri.file(file), findings.map(f => {
        const data = toDiagnosticData(f);
        const diag = new Diagnostic(
          new Range(data.line, 0, data.line, Number.MAX_SAFE_INTEGER),
          data.message,
          data.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning
        );
        diag.source = 'foam-lint';
        diag.code = data.code;
        return diag;
      }));
    });

    // The tree shows unscoped totals so debt stays discoverable even when the
    // Problems panel is limited to open files. Only the diagnostics depend on
    // which editors are open, so skip the tree's rebuild unless the cache
    // (identity, set only by run()/clear()) actually changed.
    if ( this.lastPushed !== this.cache ) {
      this.lastPushed = this.cache;
      this.treeProvider.setLintFindings(this.cache);
    }
  }

  clear(): void {
    if ( this.disposed ) return;
    if ( this.timer ) { clearTimeout(this.timer); this.timer = null; }
    this.cache = [];
    this.collection.clear();
    this.treeProvider.setLintFindings([]);
    this.lastPushed = this.cache;
  }

  get findingCount(): number { return this.cache.length; }
}
