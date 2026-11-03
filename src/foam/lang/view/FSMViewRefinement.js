/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang.view',
  name: 'FSMViewRefinement',
  refines: 'foam.lang.StateMachineEnum',
  documentation: 'Adds some properties to the StateMachineModel that are used in the FSM wizard and display of FSM Properties',
  properties: [
    {
      class: 'String',
      name: 'stepTitle',
      transient: true,
      documentation: 'Display title for the wizard step (defaults to label)'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'customViewClass',
      transient: true,
      generateJava: false,
      documentation: 'WARNING: DEPRECATED - use view instead. Optional custom view class spec for complex steps'
    },
    {
      class: 'foam.u2.ViewSpec',
      name: 'view',
      expression: function(customViewClass) {
        return customViewClass;
      },
      transient: true,
      generateJava: false,
      documentation: 'Optional custom view class spec for complex steps'
    },
    {
      class: 'Boolean',
      name: 'optional',
      transient: true,
      value: false,
      documentation: 'Whether this step can be skipped'
    },
    {
      class: 'String',
      name: 'stepDescription',
      transient: true,
      documentation: 'Help text shown at the top of the step'
    },
    {
      class: 'String',
      name: 'stepIcon',
      transient: true,
      documentation: 'SVG icon path to display in the wizard step indicator'
    }
  ]
});
