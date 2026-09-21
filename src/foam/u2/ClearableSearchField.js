/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'ClearableSearchField',
  extends: 'foam.u2.View',

  documentation: `
    foam.u2.SearchField plus foam.u2.borders.ClearableSearchBorder: a search
    input with a real, keyboard-reachable clear (X) button. Prefer it anywhere a
    user types a filter.

    SearchField is an <input>, so it cannot host the button as a child - hence a
    composite view rather than a flag on SearchField.

      { class: 'String', name: 'search', view: { class: 'foam.u2.ClearableSearchField' } }
  `,

  requires: [
    'foam.u2.SearchField',
    'foam.u2.borders.ClearableSearchBorder'
  ],

  css: `
    ^ { width: 100%; }
  `,

  properties: [
    {
      class: 'Boolean',
      name: 'onKey',
      value: true,
      documentation: 'Update data on every keystroke. On by default; blur-only search is rarely wanted.'
    },
    {
      class: 'String',
      name: 'placeholder',
      documentation: `Overrides SearchField's 'Search...'. Also taken from the
        property's own placeholder:, which a bare SearchField ignores.`
    },
    {
      class: 'String',
      name: 'ariaLabel'
    },
    {
      class: 'String',
      name: 'autocomplete'
    },
    {
      class: 'String',
      name: 'inputName',
      documentation: `The input's name attribute. Set it here, not with attrs() -
        attrs() lands on the wrapper div. Defaults to the property name.`
    },
    {
      name: 'field_',
      documentation: 'Inner SearchField; kept so focus() and the clear button can reach it.'
    },
    {
      name: 'prop_',
      documentation: 'Set by fromProperty() before render; forwarded to the inner field.'
    }
  ],

  methods: [
    function render() {
      var self = this;

      var field = this.SearchField.create({
        data$:     this.data$,
        onKey:     this.onKey,
        mode$:     this.mode$,
        focused:   this.focused,
        ariaLabel: this.ariaLabel
      }, this);

      if ( this.autocomplete ) field.autocomplete = this.autocomplete;

      // fromProperty first, then an explicit placeholder over top of it.
      if ( this.prop_ ) field.fromProperty(this.prop_);
      if ( this.placeholder ) field.placeholder = this.placeholder;
      if ( this.inputName ) field.attrs({ name: this.inputName });

      this.field_ = field;

      this
        .addClass()
        .start(this.ClearableSearchBorder, {
          textSlot: this.data$,
          onClear:  function() {
            self.data = '';
            field.focus();
          }
        })
          .add(field)
        .end();
    },

    function focus() {
      if ( this.field_ ) {
        this.field_.focus();
        return this;
      }
      // Not rendered yet - focus the inner field once it exists.
      this.focused = true;
      return this;
    },

    function fromProperty(p) {
      this.prop_ = p;
      if ( ! this.placeholder && p.placeholder ) this.placeholder = p.placeholder;
      if ( ! this.inputName ) this.inputName = p.name;
    }
  ]
});
