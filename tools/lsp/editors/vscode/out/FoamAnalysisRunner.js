"use strict";
/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoamAnalysisRunner = void 0;
class FoamAnalysisRunner {
    constructor(client, treeProvider) {
        this.client = client;
        this.treeProvider = treeProvider;
    }
    async run() {
        this.treeProvider.setRunning(true);
        try {
            var results = await this.client.sendRequest('foam/analyzeWorkspace', {});
            this.treeProvider.setResults(results);
        }
        catch (e) {
            this.treeProvider.setRunning(false);
            throw e;
        }
    }
    handleProgress(params) {
        // Progress updates could be shown in status bar or tree view
        // For now the tree shows "Running..." during analysis
    }
}
exports.FoamAnalysisRunner = FoamAnalysisRunner;
//# sourceMappingURL=FoamAnalysisRunner.js.map