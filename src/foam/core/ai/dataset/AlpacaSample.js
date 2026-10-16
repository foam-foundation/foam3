/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.dataset',
  name: 'AlpacaSample',

  documentation: `
    One instruction-answer training pair in Alpaca format.
    id is set to the first 16 hex chars of SHA-256(instruction + output),
    which serves as a dedup key: dao.find(id) before every put().
  `,

  tableColumns: [ 'id', 'language', 'sourceFile', 'instruction' ],

  searchColumns: [ 'language', 'sourceFile' ],

  properties: [
    {
      class: 'String',
      name: 'id',
      documentation: 'SHA-256(instruction + output), truncated to 16 hex chars.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'instruction',
      required: true,
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 80 }
    },
    {
      class: 'String',
      name: 'input',
      documentation: 'Existing code context passed to the model. Empty for from-scratch tasks.',
      view: { class: 'foam.u2.tag.TextArea', rows: 6, cols: 80 }
    },
    {
      class: 'String',
      name: 'output',
      required: true,
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 80 }
    },
    {
      class: 'String',
      name: 'sourceFile',
      documentation: 'Path of the source file this sample was generated from.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'language',
      documentation: 'js | java | jrl | markdown | mixed',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    }
  ],

  methods: [
    function toSummary() {
      return this.instruction.substring(0, 80);
    }
  ]
});
