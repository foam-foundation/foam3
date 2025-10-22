/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.parse.auto',
  name: 'SearchView',
  extends: 'foam.u2.TextField',

  documentation: `
    A Search TextField which provides AutoComplete support.
    Works with any FOAM parser which makes suggestions.
    parser: must be supplied
  `,

  requires: [
    'foam.parse.SimpleQueryParser',
    'foam.parse.auto.AutoCompleter'
  ],

  properties: [
    [ 'type', 'search' ],
    { class: 'String', name: 'preview' },
    {
      name: 'autoCompleter',
      factory: function() { return this.AutoCompleter.create({autoQuery$: this.preview$}); }
    },
    {
      name: 'parser'
    }
  ],

  methods: [
    function render() {
      this.SUPER();
      this.autoCompleter.addToE(this.parentNode);
      this.preview$.sub(this.onPreviewChange);

      // We want to value to update onKey for purposes on the auto-completer
      // But not for the actual 'data' update which could cause searches
      // on each keystroke.
      // So we bind the input field's value twice, onKey to 'preview' and on leave to 'data'
      this.attrSlot(null, 'input').linkFrom(this.preview$);
    }
  ],

  listeners: [
    {
      name: 'onPreviewChange',
      isFramed: true,
      code: function() {
        this.autoCompleter.reset();

        var ps = this.parser.parseString(
          this.preview + String.fromCharCode(26) /* EOF */,
          undefined,
          this.autoCompleter.apply);

        return ps || null;
      }
    }
  ]
});
