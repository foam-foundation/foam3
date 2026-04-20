/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'EnumSuggester',
  extends: 'foam.u2.View',

  documentation: `
    A suggester view for Enum and StateMachine properties in the AQL search bar.
    Shows each value of the enum class via ReadOnlyEnumView (pill with color/glyph
    when the enum defines them, plain label otherwise). SmartView passes a
    'filter' string (the text typed after the operator) which narrows the list
    by CONTAINS_IC on both 'name' and 'label'. Selecting a value inserts its
    .name (which the AQL grammar's literalIC parser already accepts).

    Works for class: 'Enum' and class: 'StateMachine' (the latter extends
    foam.lang.Enum, so the same isInstance check in SimpleQueryParser catches
    both).
  `,

  requires: [
    'foam.u2.view.ReadOnlyEnumView'
  ],

  css: `
    ^row {
      display: flex;
      align-items: center;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    ^row:hover {
      background-color: $backgroundBrandTertiary;
    }
  `,

  properties: [
    'suggestText',
    { class: 'Class',  name: 'of' },
    { class: 'String', name: 'filter' }
  ],

  methods: [
    function render() {
      this.addClass();
      var self = this;
      if ( ! this.of || ! this.of.VALUES ) return;

      var f      = (this.filter || '').toUpperCase();
      var values = this.of.VALUES.filter(function(v) {
        if ( ! f ) return true;
        return ( v.name  && v.name.toUpperCase().indexOf(f)  !== -1 ) ||
               ( v.label && v.label.toUpperCase().indexOf(f) !== -1 );
      });

      var isFirst = true;
      this
        .start()
          .forEach(values, function(v) {
            if ( ! isFirst ) {
              this.start().addClass('foam-parse-auto-SmartView-suggestionSeparator').end();
            }
            isFirst = false;
            // Wrap the pill in a full-width clickable row. ReadOnlyEnumView is
            // inline-flex with width: max-content, so its DOM bounds == pill pixels.
            // Without this wrapper, clicks on the row's white space miss the handler
            // entirely, the field loses focus, and SmartView's debounced 
            // onBlur (250ms) calls reset() which empties suggestions.
            this.start()
              .addClass(self.myClass('row'))
              .on('click', function() { self.suggestText(v.name + ' '); })
              .start(self.ReadOnlyEnumView, { data: v, showGlyph: true }).end()
            .end();
          })
        .end();
    }
  ]
});
