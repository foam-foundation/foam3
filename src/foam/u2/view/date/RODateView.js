/**
 * @license
 * Copyright 2021 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.view.date',
  name: 'RODateView',
  extends: 'foam.u2.View',

  documentation: 'A ReadOnly DateView',

  methods: [
    function render() {
      this.SUPER();
      this.start('div', {
          tooltip$: this.data$.map(d => d ? d.toLocaleDateString(foam.util.getClientLocale(), {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }) : foam.u2.DateView.DATE_FORMAT)
        }).
        addClass(this.myClass()).
        add(this.data$.map(d => d ? d.toLocaleDateString(foam.util.getClientLocale(), this.options) : foam.u2.DateView.DATE_FORMAT)).
      end();
    }
  ]
});
