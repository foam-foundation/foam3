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
      // Build predicates against columns in the model's searchColumns axiom:
      //   - String columns    → CONTAINS_IC(col, filter)
      //   - Numeric columns   → EQ(col, +filter)   (when filter parses as number)
      //   - Reference columns → resolved to the ID type they store, then above
      //   - Enum/Date/Boolean/etc. are skipped (Binary.adapt would throw).
      // Falls back to KEYWORD when no usable columns are available.
      var self        = this;
      var searchAxiom = this.of.getAxiomByName('searchColumns');
      var cols        = ( searchAxiom && searchAxiom.columns ) || [];

      var preds = cols
        .map(function(name)    { return self.of.getAxiomByName(name); })
        .filter(function(p)    { return p; })
        .map(function(p)       { return self.columnPredicate_(p, filter); })
        .filter(function(pred) { return pred; });

      if ( preds.length > 0 ) return this.OR.apply(this, preds);

      console.warn(
        '[ReferenceSuggester] Falling back to KEYWORD for ' + this.of.id +
        ' - no usable searchColumns for filter "' + filter + '". ' +
        'KEYWORD scans all keyword-indexed properties on the server which is ' +
        'less efficient. Declare `searchColumns` with String/Int properties on ' +
        this.of.id + ' (e.g. name, email, id) for targeted filtering.'
      );
      return this.KEYWORD(filter);
    },

    function columnPredicate_(prop, filter) {
      // Return the best predicate for one column, or null if the column's
      // type can't be safely filtered by `filter`.
      var type = this.effectivePropertyType_(prop);

      if ( foam.lang.String.isInstance(type) ) {
        return this.CONTAINS_IC(prop, filter);
      }
      if ( foam.lang.Int.isInstance(type) ) {
        var n = this.parseNumber_(filter);
        return n === null ? null : this.EQ(prop, n);
      }
      return null;
    },

    function effectivePropertyType_(prop) {
      // A Reference doesn't store the referenced object — it stores the ID.
      // Unwrap Reference → target model's ID property (resolving IDAlias for
      // compound-ID models) so callers can check the real stored type.
      if ( ! foam.lang.Reference.isInstance(prop) ) return prop;
      var id = prop.of.ID;
      if ( foam.lang.IDAlias.isInstance(id) ) {
        id = prop.of.getAxiomByName(id.propName);
      }
      return id;
    },

    function parseNumber_(str) {
      if ( str === '' ) return null;
      var n = Number(str);
      return isNaN(n) ? null : n;
    }
  ]
});
