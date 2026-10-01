/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'ClearableSearchBorder',
  extends: 'foam.u2.Element',

  documentation: `
    Renders an accessible clear (X) button over a search field's right edge. The
    native ::-webkit-search-cancel-button is suppressed: Chrome/Safari only,
    absent from the accessibility tree, unreachable by keyboard.

    Low-level primitive. To wrap a plain SearchField use
    foam.u2.ClearableSearchField - same pairing, already assembled, with the
    property-view plumbing. Use this directly when the field is not a SearchField
    or its visible text is not data, as in TextSearchView (SmartView's preview).

    Callers supply:
      textSlot - slot of the visible text; the button shows only when non-empty
      onClear  - clears the text and returns focus to the field
  `,

  messages: [
    {
      name: 'CLEAR_SEARCH',
      messageMap: {
        en: 'Clear search',
        fr: 'Effacer la recherche'
      }
    }
  ],

  css: `
  ^ {
    display: flex;
    position: relative;
  }

  ^ > *:first-child {
    flex: 1;
  }

  ^ input[type="search"] {
    padding-right: 36px;
  }

  ^ input[type="search"]::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  ^clear {
    align-items: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    bottom: 0;
    cursor: pointer;
    display: flex;
    height: 24px;
    justify-content: center;
    margin: auto 0;
    padding: 0;
    position: absolute;
    right: 6px;
    top: 0;
    width: 24px;
  }

  ^:hover ^clear {
    background: $grey100;
    outline: 1px dashed $borderStrong;
    outline-offset: 2px;
  }

  ^clear:hover {
    background: $grey200;
  }

  ^clear:focus-visible {
    background: $grey100;
    outline: 2px solid $blue400;
    outline-offset: 2px;
  }
  `,

  properties: [
    {
      name: 'textSlot',
      documentation: 'Slot of the visible search text; controls button visibility.'
    },
    {
      class: 'Function',
      name: 'onClear'
    }
  ],

  methods: [
    function render() {
      var self = this;
      this
        .addClass()
        .tag('div', null, this.content$)
        .start('button')
          .addClass(this.myClass('clear'))
          .attrs({ type: 'button', 'aria-label': this.CLEAR_SEARCH, title: this.CLEAR_SEARCH })
          .show(this.textSlot.map(v => !! v))
          .start('img').attrs({ src: '/images/cancel-round.svg', alt: '' }).end()
          .on('click', function() { self.onClear(); })
        .end();
    }
  ]
});
