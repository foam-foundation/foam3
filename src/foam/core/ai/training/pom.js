/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.POM({
  name: 'training',

  projects: [
    { name: 'provider/pom' }
  ],

  files: [
    { name: 'TrainingRun',    flags: 'js|java' },
    { name: 'TrainingMetric', flags: 'js|java' },
    { name: 'EvalPrompt',     flags: 'js|java' },
    { name: 'EvalRun',        flags: 'js|java' },
    { name: 'EvalResult',     flags: 'js|java' }
  ]
});
