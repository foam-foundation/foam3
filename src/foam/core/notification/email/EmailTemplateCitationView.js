/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification.email',
  name: 'EmailTemplateCitationView',
  extends: 'foam.u2.CitationView',

  documentation: 'A single row in a list of email templates.',

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
      of: 'foam.core.notification.email.EmailTemplate',
      name: 'data',
      documentation: 'Set this to the template you want to display in this row.'
    }
  ],

  methods: [
    function render() {
      this
        .addClass()
        .start()
          .start()
            .addClass('p-legal-light', this.myClass('summary'))
            .add(this.data.name, ' (', this.data.id, ')')
          .end()
          .start()
            .addClass('p-xs', this.myClass('email'))
            .add('group: ', this.data.group, ', locale: ', this.data.locale)
          .end()
        .end();
    }
  ]
});

