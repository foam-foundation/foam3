/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.analytics',
  name: 'CandlestickKeyView',
  extends: 'foam.u2.View',

  documentation: 'A single row in a list of Candlesticks.',

  css: `
    << {
      background: $backgroundDefault;
      padding: 8px 16px;
    }

    <<:hover {
      background: $backgroundDefault$hover;
      cursor: pointer;
    }

    <<key {
      color: $textTertiary;
    }
  `,

  properties: [
    {
      class: 'FObjectProperty',
      of: 'foam.core.analytics.Candlestick',
      name: 'data',
      documentation: 'Set this to the Candlestick you want to display in this row.'
    }
  ],

  methods: [
    function render() {
      this
        .addClass(this.myClass())
        .start()
          .start()
            .addClass('p-xs', this.myClass('key'))
            .add(this.data.key)
          .end()
        .end();
    }
  ]
});
