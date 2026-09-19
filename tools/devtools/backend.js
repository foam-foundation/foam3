/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Core of the page-world backend: a method registry and one dispatcher.
// Feature files (inspect-backend.js, later card/dao/...) call register(); the
// panel side only ever evaluates window.__foamDevtools.call(name, ...args).
// This file never grows per feature.
(function(exports) {
  if ( exports.call ) return; // already installed (content script re-injected)

  var registry = {};

  function S(x) {
    try { return JSON.stringify(x); }
    catch (e) { return JSON.stringify({ error: 'stringify: ' + e.message }); }
  }

  // chrome.devtools.inspectedWindow.eval can only marshal JSON-serialisable
  // values, and a throw on the page side reaches the panel as an opaque
  // exception object. So every result leaves as a JSON string and every
  // throw becomes {error: message} — the panel never has to special-case it.
  function guard(fn) {
    return function() {
      try { return S(fn.apply(null, arguments)); }
      catch (e) { return S({ error: e.message }); }
    };
  }

  function foamReady() {
    return typeof window !== 'undefined' &&
           typeof window.foam !== 'undefined' && !! window.foam.__context__ &&
           typeof window.ctrl !== 'undefined' && !! window.ctrl;
  }

  exports.foamReady = foamReady;
  exports.register  = function(name, fn) { registry[name] = fn; };
  exports.call      = guard(function(name) {
    var fn = registry[name];
    if ( ! fn ) throw new Error('unknown method: ' + name);
    return fn.apply(null, Array.prototype.slice.call(arguments, 1));
  });
})(typeof module !== 'undefined' ? module.exports : ( window.__foamDevtools = window.__foamDevtools || {} ));
