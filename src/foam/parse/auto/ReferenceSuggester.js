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
    narrow results. 
    For searching, prefers CONTAINS_IC on the model's searchColumns axiom
    (mirroring RichChoiceView); falls back to KEYWORD if none declared.
    Selecting a record inserts its ID.
  `,

  requires: [
    'foam.u2.CitationView'
  ],

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
        ? dao.where(this.buildFilterPredicate_(this.filter))
        : dao;
      
      let isFirstElement = true;
      this
        .start()
          .select(filtered.limit(self.resultLimit), function(obj) {
            if ( ! isFirstElement ) {
              this.start().addClass('foam-parse-auto-SmartView-suggestionSeparator').end();
            }
            isFirstElement = false;
            this.start(self.CitationView, { data: obj })
              .addClass(self.myClass('row'))
              .on('click', function() { self.suggestText(obj.id + ' '); })
            .end();
          })
        .end();
    },

    function buildFilterPredicate_(filter) {
      // Prefer CONTAINS_IC against columns of type:String in the model's
      // searchColumns axiom. Non-String properties (Enum, Long, Reference,
      // etc.) are skipped because Binary.adapt would coerce the keyword
      // to arg1's type and throw on anything that isn't a valid literal
      // of that type. Falls back to KEYWORD when no usable columns remain.
      var searchAxiom = this.of.getAxiomByName('searchColumns');
      var cols = searchAxiom && searchAxiom.columns;
      if ( cols && cols.length > 0 ) {
        var self = this;
        var props = cols
          .map(function(name) { return self.of.getAxiomByName(name); })
          .filter(function(p) { return p && foam.lang.String.isInstance(p); });
        if ( props.length > 0 ) {
          return this.OR.apply(this, props.map(function(p) {
            return self.CONTAINS_IC(p, filter);
          }));
        }
      }
      return this.KEYWORD(filter);
    }
  ]
});
