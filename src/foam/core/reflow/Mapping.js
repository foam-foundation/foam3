/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'Mapping',

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: "foam.mlang.ExprProperty",
      name: 'handler',
      view: function(_, X) {
        return { class: 'foam.core.reflow.PropertyChoiceView', forCls: X.data.of };
      }
    },
    {
      name: 'of',
      hidden: true
    }
  ],

  methods: [
    function process(obj, value) {
      if ( foam.String.isInstance(value) ) value = value.trim();
      if ( value !== '' && this.handler && this.handler.name ) {
        obj[this.handler.name] = value;
      } else {
        console.warn('Mapping.process: No handler defined for', this.id, 'with value', value);
      }
    }
  ]
});