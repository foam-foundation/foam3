/**
* @license
* Copyright 2023 The FOAM Authors. All Rights Reserved.
* http://www.apache.org/licenses/LICENSE-2.0
*/

foam.CLASS({
  package: 'foam.u2.view',
  name: 'RODateTimeView',
  extends: 'foam.u2.View',

  documentation: 'A ReadOnly DateTime View',

  properties: [
    {
      class: 'Map',
      name: 'options',
      factory: function() {
        return {};
      }
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.start().
        addClass(this.myClass()).
        add(this.data$.map(d => d ? new Date(d).toLocaleString(foam.locale, this.options) : foam.u2.DateTimeView.DATE_FORMAT)).
      end();
    }
  ]
});
