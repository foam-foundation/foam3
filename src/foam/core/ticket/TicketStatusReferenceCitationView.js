/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketStatusReferenceCitationView',
  extends: 'foam.u2.view.ReferenceCitationView',

  documentation: `Shows a TicketStatus as a coloured pill, as an enum value is
    shown. ReadReferenceView creates a ReferenceCitationView for the found
    status, and the Faceted lookup on CitationView picks this class for a
    TicketStatus by its name.`,

  requires: [
    'foam.u2.view.ReadOnlyEnumView'
  ],

  methods: [
    function render() {
      // this.data is the found TicketStatus, e.g. OPEN with color $blue600.
      this.tag(this.ReadOnlyEnumView, { data: this.data });
    }
  ]
});
