/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'NodeWindow',

  documentation: `
    Encapsulates top-level window/document features.

    Export common window/document services through the Context.

    When running under NodeJS, where there is no window object, provides suitable
    stubs and replacements so that code can still find these dependencies.

    Used as a replacement for foam.lang.Window when running in NodeJS.
  `,

  exports: [
    'cancelAnimationFrame',
    'clearTimeout',
    'currentMenu',
    'location',
    'notify',
    'pushDefaultMenu',
    'pushMenu',
    'requestAnimationFrame',
    'routeTo',
    'setTimeout'
  ],

  properties: [
    [ 'location', { origin: 'http://localhost:8080', search: '' } ]
  ],

  methods: [
    function requestAnimationFrame(f) {
      return this.setTimeout(f, 16);
    },
    function cancelAnimationFrame(id) {
      this.clearTimeout(id);
    },
    function notify(msg) { console.log('NOTIFY:', msg); },
    function pushMenu() {},
    function currentMenu() {},
    function pushDefaultMenu() {},
    function routeTo() {},
    function setTimeout(f, t) {
      return globalThis.setTimeout(f, t);
    },
    function clearTimeout(id) {
      globalThis.clearTimeout(id);
    },
    function addEventListener() {
      // Stub for Node.js environment - no-op
    },
    function removeEventListener() {
      // Stub for Node.js environment - no-op
    }
  ]
});

foam.SCRIPT({
  package: 'foam.lang',
  name: 'NodeWindowScript',
  requires: [
    'foam.lang.NodeWindow',
  ],
  code: function() {
    let nw = foam.lang.NodeWindow.create(
      { window: globalThis },
      foam.__context__
    );
    foam.__context__ = nw.__subContext__;

    globalThis.location = foam.__context__.location;
    globalThis.requestAnimationFrame = nw.requestAnimationFrame.bind(nw);
    globalThis.cancelAnimationFrame  = nw.cancelAnimationFrame.bind(nw);
    globalThis.addEventListener = nw.addEventListener.bind(nw);
    globalThis.removeEventListener = nw.removeEventListener.bind(nw);
  }
});
