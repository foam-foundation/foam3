/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'RankedOutcome',
  ids: ['label'],
  properties: [
    {
      name: 'label',
      class: 'String'
    },
    {
      name: 'outcome'
    },
    {
      name: 'score',
      class: 'Float'
    },
    {
      name: 'matching',
      class: 'Int'
    },
    {
      name: 'specificity',
      class: 'Int'
    }
  ]
});

foam.CLASS({
  package: 'foam.u2.qa',
  name: 'RankedOutcomeCitationView',
  extends: 'foam.u2.CitationView',

  css: `
    ^label {
      color: $textDefault;
    }
    ^meta {
      color: $textTertiary;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.u2.qa.RankedOutcome',
      name: 'data'
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())
        .start()
          .start().addClass('p-semiBold', this.myClass('label')).add(this.data.label).end()
          .start().addClass('p-legal', this.myClass('meta'))
            .add(this.data.matching + '/' + this.data.specificity + ' conditions match')
          .end()
        .end();
    }
  ]
});
