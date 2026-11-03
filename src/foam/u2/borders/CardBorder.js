/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'CardBorder',
  extends: 'foam.u2.Element',

  css: `
    << {
      min-height: 60px;

      background-color: $backgroundDefault;
      border: solid 1px $borderDefault;
      border-radius: 5px;

      padding: 16px;
    }
  `,

  documentation: 'A stylized border. Intended for use when creating cards.',

  methods: [
    function render() {
      this.addClass();
    }
  ]
});
