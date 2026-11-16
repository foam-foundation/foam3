/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'EvalResult',

  documentation: `
    One prompt's result within one EvalRun. Written by MLXEvalJob as
    EVAL_RESULT lines arrive from the Python eval script.

    Composite primary key [evalRunId, promptId] — one result per
    prompt per run. Query by promptId across runs to trend a gap
    over training iterations; query by evalRunId to see the full
    report for one checkpoint.
  `,

  ids: [ 'evalRunId', 'promptId' ],

  tableColumns: [ 'promptId', 'evalRunId', 'passed', 'score', 'outputTokens', 'generationMs' ],

  searchColumns: [ 'evalRunId', 'promptId', 'passed' ],

  properties: [
    {
      class: 'String',
      name: 'evalRunId',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Long',
      name: 'promptId',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'response',
      documentation: 'Raw model output.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      view: { class: 'foam.u2.tag.TextArea', rows: 10, cols: 80 }
    },
    {
      class: 'Boolean',
      name: 'passed',
      documentation: 'True when all required rubric items matched.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'score',
      documentation: 'Fraction of all rubric items (required + optional) that matched.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'StringArray',
      name: 'rubricHits',
      documentation: 'Patterns from the rubric that were found in the response.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'inputTokens',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'outputTokens',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Long',
      name: 'generationMs',
      documentation: 'Wall-clock inference time in milliseconds.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    }
  ]
});
