/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'CitationView',
  extends: 'foam.u2.View',

  axioms: [
    foam.pattern.Faceted.create({inherit: true})
  ],

  cssTokens: [
    {
      name: 'padding',
      value: '4px 8px'
    }
  ],

  css: `
    ^rw {
      padding: $padding;
      color: $black;
    }

    ^rw:hover:not([disabled]) {
      background: $grey50;
      cursor: pointer;
    }
  `,

  properties: [
    {
      class: 'Class',
      name: 'of'
    },
    {
      class: 'String',
      name: 'summary'
    }
  ],

  listeners: [
    {
      name: 'updateSummary',
      isFramed: true,
      on: [
        'data.propertyChange',
        'this.propertyChange.data'//TODO check if we can delete it.
      ],
      code: async function() {
        let newSummary;

        if ( this.data ) {
          var summary = this.getSummary(this.data);

          newSummary = summary instanceof Promise
            ? await summary
            : summary;
        } else {
          newSummary = undefined;
        }

        this.summary = newSummary;
      }
    }
  ],

  methods: [
    function init() {
      this.enableClass(this.myClass('rw'), this.mode$.map(m => m === foam.u2.DisplayMode.RW))
    },
    function render() {
      this.SUPER();
      this.updateSummary();
      this
        .addClass('p', this.myClass('row'))
        .add(this.summary$);
    },

    function getSummary(data) {
      return data.toSummary?.();
    }
  ]
});
