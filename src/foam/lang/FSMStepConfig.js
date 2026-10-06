/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * General-purpose FSM Step Wizard View System
 * Converts any FSM property into a multi-step wizard interface
 */

foam.CLASS({
    package: 'foam.lang',
    name: 'FSMStepConfig',
  
    documentation: 'Configuration for a single step in the FSM wizard',
  
    properties: [
      {
        class: 'String',
        name: 'fsmValue',
        documentation: 'The FSM enum value name this step corresponds to'
      },
      {
        class: 'String',
        name: 'title',
        documentation: 'Display title for the step (defaults to FSM label)'
      },
      {
        class: 'String',
        name: 'stepIcon',
        documentation: 'SVG icon path displayed in the step indicator'
      },
      {
        class: 'StringArray',
        name: 'properties',
        documentation: 'Array of property names to show in this step'
      },
      {
        class: 'foam.u2.ViewSpec',
        name: 'customView',
        documentation: 'Optional custom view to render instead of auto-generated fields'
      },
      {
        class: 'Function',
        name: 'validationFn',
        documentation: 'Optional validation function: (data) => { isValid, errors[] }'
      },
      {
        class: 'Boolean',
        name: 'optional',
        value: false,
        documentation: 'If true, this step can be skipped'
      }
    ]
});
