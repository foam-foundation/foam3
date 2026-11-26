/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'EvalRun',

  documentation: `
    One evaluation pass against a single model checkpoint.
    Created by MLXEvalJob before the Python subprocess starts,
    updated with final pass counts when the job completes.

    Links to the TrainingRun that produced the checkpoint (optional),
    and groups all EvalResult records for this pass via evalRunId.
    Compare two runs by querying evalResultDAO filtered to each runId.
  `,

  tableColumns: [
    'id', 'trainingRunId', 'modelPath', 'adapterPath',
    'promptCount', 'passCount', 'passRate', 'startedAt'
  ],

  searchColumns: [ 'trainingRunId', 'modelPath' ],

  properties: [
    {
      class: 'String',
      name: 'id',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'trainingRunId',
      documentation: 'Optional FK into trainingRunDAO — the run that produced this checkpoint.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'modelPath',
      documentation: 'HuggingFace model id or local path used as the base.',
      required: true
    },
    {
      class: 'String',
      name: 'adapterPath',
      documentation: 'Adapter or fused model path. Empty when evaluating the base model.'
    },
    {
      class: 'Enum',
      of: 'foam.core.job.JobStatus',
      name: 'status',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'DateTime',
      name: 'startedAt',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'DateTime',
      name: 'completedAt',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'promptCount',
      documentation: 'Total prompts evaluated.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'passCount',
      documentation: 'Prompts where all required rubric items matched.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'passRate',
      documentation: 'passCount / promptCount. Computed.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      expression: function(passCount, promptCount) {
        return promptCount > 0 ? passCount / promptCount : 0;
      },
      javaGetter: `return getPromptCount() > 0 ? (float) getPassCount() / getPromptCount() : 0f;`
    },
    {
      class: 'String',
      name: 'notes',
      documentation: 'Hypothesis, what changed between this run and the previous.',
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 80 }
    }
  ],

  methods: [
    function toSummary() {
      return this.modelPath + (this.adapterPath ? ' + ' + this.adapterPath : ' (base)');
    }
  ]
});
