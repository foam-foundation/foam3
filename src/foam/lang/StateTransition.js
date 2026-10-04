/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'StateTransition',

  documentation: 'Record of a single state transition.',

  ids: [ 'timestamp' ],

  sections: [
    {
      name: '_defaultSection',
      title: 'Transition Info',
      view: {
        class: 'foam.u2.detail.TabularSectionView'
      }
    },
    {
      name: 'extras',
      title: 'Additonal Information'
    }
  ],

  properties: [
    {
      class: 'String',
      name: 'from',
      documentation: 'Name of the state transitioned from.'
    },
    {
      class: 'String',
      name: 'to',
      documentation: 'Name of the state transitioned to.'
    },
    {
      class: 'DateTime',
      name: 'timestamp',
      documentation: 'When the transition occurred.',
      factory: function() { return new Date(); }
    },
    {
      class: 'String',
      name: 'userId',
      documentation: 'ID of user who triggered the transition.'
    },
    {
      class: 'String',
      name: 'userName',
      documentation: 'Display name of user who triggered the transition.'
    },
    {
      class: 'String',
      name: 'note',
      section: 'extras',
      documentation: 'Optional note or reason for the transition.'
    },
    {
      class: 'FObjectProperty',
      name: 'payload',
      section: 'extras',
      documentation: 'Optional extra information about the transition.'
    },
    {
      class: 'String',
      name: 'payloadSummary',
      transient: true,
      expression: function(payload) {
        return payload ? payload.toSummary() : '';
      }
    }
  ]
});
