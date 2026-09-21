/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.flow',
  name: 'FlowDocumentRowView',
  extends: 'foam.u2.View',
  documentation: 'Container view for FlowDocumentCitationView',

  requires: [ 'foam.flow.FlowDocumentCitationView' ],

  exports: [ 'as rowView' ],

  methods: [
    function render() {
      this.tag(this.FlowDocumentCitationView, {
        data: this.data
      })
    }
  ]
});