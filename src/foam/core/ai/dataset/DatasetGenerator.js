/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'DatasetGenerator',

  documentation: `
    Walks source directories, reads FOAM source files (.js, .java, .jrl, .md),
    splits them into semantically meaningful chunks, calls an LLM to generate
    Alpaca-format instruction-answer pairs, and stores results in datasetDAO.

    Deduplication: id = SHA-256(instruction + output) truncated to 16 hex chars.
    dao.find(id) before each put() skips duplicates without a separate pass.

    Anonymization replaces proprietary names before any text reaches the LLM.
    Configure anonymizePatterns to add project-specific substitutions.

    Set maxFiles > 0 to cap the number of files processed — useful for test runs
    before committing to a full generation pass.
  `,

  abstract: true,

  implements: [ 'foam.lang.ContextAgent' ],

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
      documentation: 'Extensions to include.',
      factory:     function() { return ['.js', '.java', '.jrl', '.md']; },
      javaFactory: `return new String[] { ".js", ".java", ".jrl", ".md" };`
    },
    {
      class: 'StringArray',
      name: 'anonymizePatterns',
      documentation: `
        Interleaved pairs of [regex, replacement] applied before sending content to the LLM.
        Set this in your run script — do not commit proprietary names here.
        Example: ['\\\\bMyCompany\\\\b', 'Example', 'mycompany\\\\.com', 'example.com']
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
