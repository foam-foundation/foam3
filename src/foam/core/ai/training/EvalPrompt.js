/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'EvalRubricItem',

  documentation: `
    One pattern that an evaluated model response must contain.
    Embedded in EvalPrompt.rubric — not a standalone DAO record.
  `,

  properties: [
    {
      class: 'String',
      name: 'pattern',
      documentation: 'Substring the model response must contain.',
      required: true,
      view: { class: 'foam.u2.tag.TextArea', rows: 2, cols: 80 }
    },
    {
      class: 'Boolean',
      name: 'required',
      documentation: 'When true, failing this item sets EvalResult.passed = false.',
      value: true
    },
    {
      class: 'String',
      name: 'description',
      documentation: 'Why this pattern matters — shown in evaluation reports.'
    }
  ],

  methods: [
    function toSummary() {
      return this.pattern.substring(0, 60);
    }
  ]
});


foam.CLASS({
  package: 'foam.core.ai.training',
  name: 'EvalPrompt',

  documentation: `
    A prompt used to evaluate a fine-tuned model against a rubric.
    Domain-agnostic — works for any instruction-following fine-tune.

    id is assigned by the DAO (guid). category groups prompts for
    per-dimension reporting. rubric items are embedded and checked
    by the Python eval script during inference.
  `,

  tableColumns: [ 'id', 'category', 'enabled', 'prompt' ],

  searchColumns: [ 'category', 'enabled', 'tags' ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO'
    },
    {
      class: 'String',
      name: 'category',
      documentation: 'Concept being tested, e.g. "java", "slots", "ui", "jrl".',
      required: true
    },
    {
      class: 'String',
      name: 'systemPrompt',
      documentation: 'Optional system prompt override. If empty, the eval job uses its own default.',
      view: { class: 'foam.u2.tag.TextArea', rows: 3, cols: 80 }
    },
    {
      class: 'String',
      name: 'prompt',
      documentation: 'The user-turn text sent to the model.',
      required: true,
      view: { class: 'foam.u2.tag.TextArea', rows: 4, cols: 80 }
    },
    {
      class: 'FObjectArray',
      of: 'foam.core.ai.training.EvalRubricItem',
      name: 'rubric',
      documentation: 'Patterns the model response must contain. Checked by the eval script.'
    },
    {
      class: 'Boolean',
      name: 'enabled',
      documentation: 'When false, excluded from eval runs without deleting.',
      value: true
    },
    {
      class: 'StringArray',
      name: 'tags',
      documentation: 'Free-form labels for filtering, e.g. ["round2", "regression"].'
    }
  ],

  methods: [
    function toSummary() {
      return this.category + ': ' + this.prompt.substring(0, 60);
    }
  ]
});
