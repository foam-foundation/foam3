/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'DocumentRowView',
  extends: 'foam.u2.View',
  documentation: 'Container view for DocumentCitationView',

  requires: [ 'foam.core.menu.DocumentCitationView' ],

  exports: [ 'as rowView' ],

  methods: [
    function render() {
      this.tag(this.DocumentCitationView, {
        data: this.data
      })
    }
  ]
});