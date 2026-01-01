/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.reflow',
  name: 'ErrorView',
  extends: 'foam.u2.View',

  documentation: 'Displays user-friendly error messages using semantic color tokens.',

  css: `
    ^ {
      padding: 16px;
      margin: 8px 0;
      border-radius: 4px;
      border: 1px solid $borderBrand;
      background-color: $backgroundDestructiveTertiary;
      color: $textDestructive;
      font-size: 14px;
      word-break: break-word;
    }
  `,

  properties: [
    {
      class: 'String',
      name: 'message',
      documentation: 'The error message from the error object'
    },
    {
      name: 'error',
      documentation: 'The error object itself',
      postSet: function(_, error) {
        if ( ! error ) return;
        if ( ! this.instance_.message ) {
          this.message = error.message || String(error);
        }
      }
    }
  ],

  methods: [
    function render() {
      this
        .addClass()
        .add('Error: ')
        .add(this.message$);
    }
  ]
});
