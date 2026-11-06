/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.graphics',
  name: 'CViewTheme',

  documentation: `
    Colour and font tokens for a CView scene. Apps subclass and fill the maps.
    A missing token resolves to a loud fallback (magenta, or the default font)
    so a typo shows on screen instead of painting black.
  `,

  constants: {
    MISSING_COLOR: 'magenta',
    DEFAULT_FONT:  '12px sans-serif'
  },

  properties: [
    {
      name: 'colors',
      documentation: 'Plain object: token name -> CSS colour string, e.g. { ink: "#222" }.',
      factory: function() { return {}; }
    },
    {
      name: 'fonts',
      documentation: 'Plain object: token name -> CSS font shorthand, e.g. { label: "bold 11px sans-serif" }.',
      factory: function() { return {}; }
    },
    {
      class: 'String',
      name: 'background',
      documentation: 'CSS colour painted behind the scene; empty string means paint no background.'
    }
  ],

  methods: [
    function resolve(name) {
      /** Colour for a token; magenta when the token is missing so the gap is visible. */
      var c = this.colors[name];
      return c === undefined ? this.MISSING_COLOR : c;
    },

    function font(name) {
      /** Font for a token; the default font when the token is missing. */
      var f = this.fonts[name];
      return f === undefined ? this.DEFAULT_FONT : f;
    }
  ]
});
