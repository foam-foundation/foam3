/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'ReferenceSuggester',
  extends: 'foam.u2.View',

  documentation: `
    A suggester view for Reference properties in the AQL search bar.
    Shows records from the target DAO using CitationView. SmartView passes
    a 'filter' string (the text typed after the operator) which is used to
    narrow results via KEYWORD search. Selecting a record inserts its ID.
  `,

  requires: [
    'foam.u2.CitationView'
  ],

  css: `
    ^ {
      padding: 0 !important;
    }
    ^:hover {
      background-color: unset !important;
      cursor: default !important;
    }
    ^row {
      cursor: pointer;
      padding: 4px 8px;
    }
    ^row:hover {
      background-color: $backgroundBrandTertiary;
    }
  `,

  properties: [
    'suggestText',
    { class: 'Class', name: 'of' },
    { class: 'String', name: 'targetDAOKey' },
    { class: 'String', name: 'filter' },
    { class: 'Int', name: 'resultLimit', value: 10 }
  ],

  methods: [
    function render() {
      this.addClass();
      var self = this;
      var dao  = this.__subContext__[this.targetDAOKey];
      if ( ! dao ) return;

      var filtered = this.filter
        ? dao.where(this.KEYWORD(this.filter))
        : dao;

      this
        .start()
          .select(filtered.limit(self.resultLimit), function(obj) {
            this.start(self.CitationView, { data: obj })
              .addClass(self.myClass('row'))
              .on('click', function() { self.suggestText(obj.id + ' '); })
            .end();
          })
        .end();
    }
  ]
});
