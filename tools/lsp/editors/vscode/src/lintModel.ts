/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure model behind the foam-lint editor surface. Imports nothing — not even
// 'vscode' — so the whole decision layer (what is visible, how it is grouped,
// how a finding becomes a squiggle) is testable from plain node. The thin
// vscode-touching layer lives in FoamLintRunner.ts.

/** One finding as returned by the LSP's foam/lint request. */
export interface LintFinding {
  check: string;
  severity: 'error' | 'warn';
  /** Absolute path of the file the finding is anchored in. */
  path: string;
  /** 1-based line number. */
  line: number;
  message: string;
  fix?: string;
}

/** A finding reduced to what a vscode.Diagnostic needs. Line is 0-based. */
export interface DiagnosticData {
  line: number;
  severity: 'error' | 'warn';
  message: string;
  code: string;
}

/**
 * Filter the cached findings down to what should become diagnostics.
 * 'workspace' shows everything; anything else (including an unrecognised
 * value) shows only findings anchored in a currently open file — the quiet
 * default, since a whole-workspace run surfaces historical debt.
 */
export function scopeFindings(
  findings: LintFinding[], scope: string, openPaths: string[]
): LintFinding[] {
  if ( scope === 'workspace' ) return findings.slice();
  const open = new Set(openPaths);
  return findings.filter(f => open.has(f.path));
}

/** Bucket findings by the file they are anchored in, preserving order. */
export function groupByFile(findings: LintFinding[]): Map<string, LintFinding[]> {
  const byFile = new Map<string, LintFinding[]>();
  for ( const f of findings ) {
    const bucket = byFile.get(f.path);
    if ( bucket ) bucket.push(f);
    else byFile.set(f.path, [f]);
  }
  return byFile;
}

/**
 * Map a finding onto diagnostic data: 1-based line to 0-based, fix hint
 * folded into the message so it shows in the hover without a code action.
 */
export function toDiagnosticData(f: LintFinding): DiagnosticData {
  return {
    line:     Math.max(0, f.line - 1),
    severity: f.severity,
    message:  f.fix ? f.message + '\nfix: ' + f.fix : f.message,
    code:     f.check
  };
}

/** Counts for the sidebar: totals plus per-check buckets, biggest first. */
export function summarize(findings: LintFinding[]): {
  errors: number; warns: number; byCheck: Array<{ check: string; count: number }>;
} {
  let errors = 0, warns = 0;
  const counts = new Map<string, number>();
  for ( const f of findings ) {
    if ( f.severity === 'error' ) errors++; else warns++;
    counts.set(f.check, (counts.get(f.check) || 0) + 1);
  }
  const byCheck = Array.from(counts, ([check, count]) => ({ check, count }));
  byCheck.sort((a, b) => b.count - a.count || a.check.localeCompare(b.check));
  return { errors, warns, byCheck };
}
