/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.job.test',
  name: 'SleepJob',
  extends: 'foam.core.job.Job',

  documentation: `Job whose only work is to take time, in steps, reporting
    progress after each one. Set failAtStep to throw part way through.`,

  properties: [
    {
      class: 'Int',
      name: 'steps',
      value: 100
    },
    {
      documentation: 'Milliseconds spent on each step.',
      class: 'Long',
      name: 'stepTime',
      value: 1000
    },
    {
      documentation: 'Step to throw on, or -1 to run to the end.',
      class: 'Int',
      name: 'failAtStep',
      value: -1
    }
  ],

  methods: [
    {
      name: 'execute',
      javaCode: `
        for ( int i = 0 ; i < getSteps() ; i++ ) {
          if ( i == getFailAtStep() )
            throw new RuntimeException("SleepJob failed at step " + i);

          try {
            Thread.sleep(getStepTime());
          } catch ( InterruptedException e ) { }

          reportProgress(x, "step " + ( i + 1 ) + " of " + getSteps(), ( i + 1 ) * 100 / getSteps());
        }
      `
    }
  ]
});
