/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'SinkAgent',


  properties: [
    {
      class: 'Long',
      name: 'id',
      hidden: true
    },
    {
      class: 'String',
      name: 'label'
    },
    {
      class: 'String',
      name: 'value'
    },
    {
      class: 'Boolean',
      name: 'sink'
    },
    {
      class: 'String',
      name: 'type'
    }
  ],

  methods: [
    {
      name: 'toSummary',
      type: 'String',
      code: function() {
        return this.label;
      }
    }
  ]
});
