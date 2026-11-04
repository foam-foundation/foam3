/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'TrainingRun',

  documentation: `
    Record of one MLX fine-tuning run. Created when MLXTrainingJob starts,
    updated as the run progresses, and finalised with loss values when the
    job completes or is suspended.

    A resumed run sets resumedFrom to the previous run's id, forming a chain
    that the loss visualisation can follow to reconstruct the full training
    history of an adapter across multiple job submissions.
  `,

  tableColumns: [
    'id', 'modelBase', 'datasetVersion', 'status',
    'iterationsCompleted', 'finalTrainLoss', 'finalValLoss', 'duration', 'startedAt'
  ],

  searchColumns: [ 'modelBase', 'datasetVersion', 'status', 'tags' ],

  properties: [
    {
      class: 'String',
      name: 'id',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'jobId',
      documentation: 'The MLXTrainingJob that owns this run.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'modelBase',
      documentation: 'HuggingFace model id used as the base, e.g. mlx-community/Qwen2.5-7B-Instruct-4bit.',
      required: true
    },
    {
      class: 'String',
      name: 'datasetVersion',
      documentation: 'The dataset RUN_KEY used for training. Matches the key in the dataset generation script.'
    },
    {
      class: 'String',
      name: 'configFile',
      documentation: 'Path to the MLX LoRA YAML config used for this run.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'adapterPath',
      documentation: 'Path where adapter weights are written. The resume checkpoint for the next submission.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'resumedFrom',
      documentation: 'Id of the TrainingRun this run continues. Null for fresh runs.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
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
      class: 'Duration',
      name: 'duration',
      documentation: 'Wall-clock duration. Set when the job stops, whether completed or suspended.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Int',
      name: 'iterationsCompleted',
      documentation: 'Last iteration logged before completion or suspend.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'finalTrainLoss',
      documentation: 'Training loss at the last logged iteration.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'Float',
      name: 'finalValLoss',
      documentation: 'Validation loss at the last validation iteration.',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'StringArray',
      name: 'tags',
      documentation: 'Free-form labels for grouping and filtering runs, e.g. ["v1", "qwen", "full-dataset"].'
    },
    {
      class: 'String',
      name: 'notes',
      documentation: 'Human annotations — hypothesis, observations, what to try next.',
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 80 }
    }
  ],

  methods: [
    function toSummary() {
      return this.modelBase + ' · ' + (this.datasetVersion || 'no dataset');
    }
  ]
});
