/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'FlowOpenIndexedRefinement',
  refines: 'foam.core.reflow.Flow',

  documentation: `
    Lets a source link under an Ask AI answer open a Knowledge Base document:
    RAGChat finds the chunk's record, e.g. the flow "Getting Started", and calls
    its openIndexed, which opens the flow as the Knowledge Base does.
  `,

  methods: [
    function openIndexed(x) { this.REFLOW.code.call(this, x); }
  ]
});
