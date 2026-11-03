/**
 * @license
 * Copyright 2023 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserCitationView',
  extends: 'foam.u2.CitationView',

  documentation: 'A single row in a list of users.',

  css: `
    <<summary {
      color: $textDefault;
    }

    <<email {
      color: $textTertiary;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.auth.User',
      name: 'data',
      documentation: 'Set this to the user you want to display in this row.'
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())
        .start()
          .start()
            .addClass('p-legal-light', this.myClass('summary'))
            .add(this.data.toSummary())
          .end()
          .start()
            .addClass('p-xs', this.myClass('email'))
            .add(this.data.email)
          .end()
        .end();
    }
  ]
});

