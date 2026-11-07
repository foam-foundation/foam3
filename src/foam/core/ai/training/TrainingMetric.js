/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'TrainingMetric',

  documentation: `
    One data point from the MLX training output, parsed from lines like:
      Iter 10: Train loss 2.341, It/sec 3.45, Tokens/sec 1456
      Iter 100: Val loss 1.945

    Multi-part primary key (runId + iteration) means metrics are naturally
    grouped per run and ordered chronologically. The loss visualisation queries:
      trainingMetricDAO
        .where(EQ(TrainingMetric.RUN_ID, runId))
        .orderBy(TrainingMetric.ITERATION)

    To reconstruct the full history of a resumed run, union the metrics
    for the run chain: follow TrainingRun.resumedFrom until null, then
    concatenate the metric series adjusting iteration offsets.
  `,

  ids: [ 'runId', 'iteration' ],

  tableColumns: [ 'iteration', 'trainLoss', 'valLoss', 'tokensPerSec', 'runId' ],

  searchColumns: [ 'runId', 'iteration' ],

  properties: [
    {
      class: 'String',
      name: 'runId',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'iteration',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'trainLoss',
      documentation: 'Training loss at this iteration. 0 on validation-only lines.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'valLoss',
      documentation: 'Validation loss. Only non-zero on validation iterations.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'speed',
      documentation: 'Training throughput in iterations per second.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'tokensPerSec',
      documentation: 'Token throughput. Useful for comparing efficiency across model sizes and batch sizes.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    }
  ]
});
