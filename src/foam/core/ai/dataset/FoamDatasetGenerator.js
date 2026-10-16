/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'FoamDatasetGenerator',
  extends: 'foam.core.ai.dataset.DatasetGenerator',
  abstract: true,

  documentation: `
    DatasetGenerator specialised for FOAM trilingual source files.
    Adds .jrl to the default extensions and uses a FOAM-aware LLM prompt
    that teaches pattern-level FOAM idioms rather than domain-specific examples.
  `,

  properties: [
    {
      name: 'fileExtensions',
      factory:     function() { return ['.js', '.java', '.jrl', '.md']; },
      javaFactory: `return new String[] { ".js", ".java", ".jrl", ".md" };`
    }
  ]
});
