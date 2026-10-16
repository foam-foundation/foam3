/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'DatasetGenerator',

  documentation: `
    Generic base for SFT dataset generators. Walks source directories, chunks
    files, calls an LLM to produce Alpaca-format instruction-answer pairs, and
    stores results in datasetDAO.

    Subclass to specialise chunking strategy and LLM prompt for a given language
    ecosystem (see FoamDatasetGenerator for the FOAM-specific subclass).

    Deduplication: id = SHA-256(instruction + output) truncated to 16 hex chars.
    dao.find(id) before each put() skips duplicates without a separate pass.

    Anonymization replaces proprietary names before any text reaches the LLM.
    Configure anonymizePatterns in your run script — do not commit names here.

    Set maxFiles > 0 to cap the number of files processed — useful for cheap
    test runs before committing to a full generation pass.
  `,

  abstract: true,

  extends: 'foam.core.job.Job',

  properties: [
    {
      class: 'StringArray',
      name: 'sourcePaths',
      documentation: 'Directories to walk recursively.',
      required: true
    },
    {
      class: 'StringArray',
      name: 'fileExtensions',
      documentation: 'File extensions to include. Subclasses override to add ecosystem-specific extensions.',
      factory:     function() { return ['.js', '.java', '.md']; },
      javaFactory: `return new String[] { ".js", ".java", ".md" };`
    },
    {
      class: 'StringArray',
      name: 'anonymizePatterns',
      documentation: `
        Interleaved pairs of [literal string, replacement] applied before sending content to the LLM.
        Simple string replacement — no regex. Set this in your run script; do not commit names here.
        Example: ['MyCompany', 'Example', 'mycompany.com', 'example.com']
      `,
      factory:     function() { return []; },
      javaFactory: `return new String[0];`
    },
    {
      class: 'Int',
      name: 'samplesPerChunk',
      documentation: 'Instruction-answer pairs requested per chunk.',
      value: 3
    },
    {
      class: 'Int',
      name: 'maxChunkSize',
      documentation: 'Max characters per chunk for size-based splitting (Java and long .md sections).',
      value: 2000
    },
    {
      class: 'String',
      name: 'llmModel',
      documentation: 'Model id forwarded to LLMOptions. Empty = provider default.',
      value: 'gpt-4o-mini'
    },
    {
      class: 'Int',
      name: 'maxFiles',
      documentation: 'Stop after processing this many files. 0 = unlimited (full run).',
      value: 0
    }
  ]
});
