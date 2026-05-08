/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

import { LanguageClient } from 'vscode-languageclient/node';
import { FoamTreeProvider, AnalysisResults } from './FoamTreeProvider';

export class FoamAnalysisRunner {
  private client: LanguageClient;
  private treeProvider: FoamTreeProvider;

  constructor(client: LanguageClient, treeProvider: FoamTreeProvider) {
    this.client = client;
    this.treeProvider = treeProvider;
  }

  async run(): Promise<void> {
    this.treeProvider.setRunning(true);

    try {
      var results: AnalysisResults = await this.client.sendRequest('foam/analyzeWorkspace', {});
      this.treeProvider.setResults(results);
    } catch (e: any) {
      this.treeProvider.setRunning(false);
      throw e;
    }
  }

  handleProgress(params: { filesScanned: number; total: number }): void {
    // Progress updates could be shown in status bar or tree view
    // For now the tree shows "Running..." during analysis
  }
}
