/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs.graph',
  name: 'DagreLib',

  documentation: `Loads dagre from a CDN on demand.

    Unlike org.konvajs.Lib this is not a view mixin: layouters have no
    render() for a JsLib axiom to wrap, so load() is called imperatively and
    awaited. JsLib resolves its promise even when the script fails to load,
    so callers MUST check window.dagre after awaiting. The CDN URL and its
    hash must also be present in src/cspdirectives.jrl under script-src.`,

  flags: [ 'web' ],

  constants: {
    SRC: 'https://unpkg.com/dagre@0.8.5/dist/dagre.min.js'
  },

  methods: [
    function load() {
      return foam.u2.JsLib.create({ src: this.SRC }).installLib();
    }
  ]
});
