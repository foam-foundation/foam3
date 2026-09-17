/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'FlowDocumentRowView',
  extends: 'foam.u2.View',
  documentation: 'Container view for FlowDocumentCitationView',

  requires: [ 'foam.core.menu.FlowDocumentCitationView' ],

  exports: [ 'as rowView' ],

  methods: [
    function render() {
      this.tag(this.FlowDocumentCitationView, {
        data: this.data
      })
    }
  ]
});