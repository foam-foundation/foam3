/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Stepper',
  extends: 'foam.u2.Element',
  documentation: `
    Renders its <step> children as a numbered sequence joined by a line, for
    how-to instructions such as "1. Open Upload, 2. Drop the file".
  `,

  css: `
    << {
      counter-reset: step;
      margin: 8px 0;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      this.addClass();
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.markdown',
  name: 'Step',
  extends: 'foam.u2.Element',
  documentation: 'One numbered step of a Stepper; its content is markdown.',

  css: `
    << {
      counter-increment: step;
      padding: 0 0 16px 40px;
      position: relative;
    }

    <<::before {
      background-color: $backgroundBrand;
      border-radius: 50%;
      color: $textOnBrand;
      content: counter(step);
      font-weight: $font-medium;
      height: 24px;
      left: 0;
      line-height: 24px;
      position: absolute;
      text-align: center;
      top: 0;
      width: 24px;
    }

    /* The line from each number down to the next one. */
    <<:not(:last-child)::after {
      background-color: $borderLight;
      bottom: 4px;
      content: '';
      left: 11px;
      position: absolute;
      top: 28px;
      width: 2px;
    }
  `,

  methods: [
    function render() {
      this.SUPER();
      this.addClass();
    }
  ]
});

foam.SCRIPT({
  package: 'foam.u2.markdown',
  name: 'StepperTagScript',
  documentation: 'Registers stepper custom elements for use in markdown',

  code: function() {
    foam.__context__.registerElement(foam.u2.markdown.Stepper); // <stepper>
    foam.__context__.registerElement(foam.u2.markdown.Step);    // <step>
  }
});
