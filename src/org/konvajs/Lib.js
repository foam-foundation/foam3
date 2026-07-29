/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'org.konvajs',
  name: 'Lib',

  documentation: `Mixin which loads Konva from a CDN.

    Uses foam.u2.JsLib rather than org.chartjs.SequentialJsLib because Konva is
    a single file with no load-order dependencies. The CDN URL and its hash
    must also be present in src/cspdirectives.jrl under script-src.`,

  flags: [ 'web' ],

  axioms: [
    foam.u2.JsLib.create({
      src: 'https://unpkg.com/konva@9.3.3/konva.min.js'
    })
  ]
});
