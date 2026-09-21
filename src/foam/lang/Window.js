/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'Window',

  documentation: `
    Encapsulates top-level window/document features.

    Export common window/document services through the Context.

    Rather than using window or document directly, objects should import: the
    services that foam.lang.Window exports:, and then access them as this.name,
    rather than as console.name or document.name.

    All FObjects already import: [ 'error', 'log', 'warn' ], meaning
    that these do not need to be explicitly imported.

    This is done to remove dependency on the globals 'document' and 'window',
    which makes it easier to write code which works with multiple windows.

    It also allows for common services to be decorated, trapped, or replaced
    in sub-contexts (for example, to replace console.error and console.warn when
    running test).

    A foam.lang.Window is installed by FOAM on starup for the default
    window/document, but if user code opens a new Window, it should create
    and install a new foam.lang.Window explicitly.
  `,

  exports: [
    'async',
    'cancelAnimationFrame',
    'clearInterval',
    'clearTimeout',
    'colorScheme',
    'columnStorage',
    'console',
    'debug',
    'delayed',
    'document',
    'error',
    'framed',
    'getElementById',
    'getElementsByClassName',
    'idled',
    'info',
    'installCSS',
    'log',
    'merged',
    'params',
    'populateDefaultThemeVariants',
    'requestAnimationFrame',
    'returnExpandedCSS',
    'setInterval',
    'setTimeout',
    'theme',
    'warn',
    'window'
  ],

  constants: [
    {
      name: 'COLOR_SCHEME_KEY',
      value: 'foam.colorScheme',
      documentation: 'localStorage key behind colorScheme. Only Window reads or writes it.'
    }
  ],

  properties: [
    [ 'name', 'window' ],
    'window',
    {
      class: 'String',
      name: 'colorScheme',
      documentation: `The colour scheme the user picked in-app: 'light', 'dark',
        or '' to follow the OS prefers-color-scheme query. Kept in localStorage
        under COLOR_SCHEME_KEY so it outlives the page and the OS setting.
        Setting it writes (or clears) the key and re-applies
        theme.activeVariants.color for the current theme, so a control such as
        foam.u2.theme.ColorSchemeToggle only ever sets this property.`,
      factory: function() {
        var v = null;
        try { v = this.window.localStorage?.getItem(this.COLOR_SCHEME_KEY); } catch (_) {}
        return v === 'light' || v === 'dark' ? v : '';
      },
      postSet: function(_, n) {
        // Persist only. populateDefaultThemeVariants subscribes to
        // colorScheme$ and re-applies, the same way it listens to the OS query.
        try {
          if ( n ) {
            this.window.localStorage.setItem(this.COLOR_SCHEME_KEY, n);
          } else {
            this.window.localStorage.removeItem(this.COLOR_SCHEME_KEY);
          }
        } catch (_) {}
      }
    },
    {
      name: 'columnStorage',
      factory: function() { return localStorage; }
    },
    {
      name: 'document',
      factory: function() { return this.window.document; }
    },
    {
      name: 'console',
      factory: function() { return this.window.console; }
    },
    {
      name: 'params',
      getter: function() { // Changed to a getter so that it will run whenever a change is made
        var m = {};
        const params = new URLSearchParams(this.window.location.search);
        for ( const element of params.keys() ) {
          m[element] = params.get(element);
        }
        return m;
      }
    },
    {
      name: 'theme',
      factory: function() {
        return foam.u2.theme.StandaloneTheme.create({ id: 'standalone-foam', name: 'standalone-foam' }, this);
      }
    }
  ],

  methods: [
    function init() {
      /*
       We hide Elements by adding this style rather than setting
       'display: none' directly because then when we re-show the
       Element we don't need to remember its desired 'display' value.
      */
      this.installCSS(`
        .foam-u2-Element-hidden {
          display: none !important;
        }
      `, 'global', 'Window');
      this.document?.addEventListener('DOMContentLoaded', () => {
        this.populateDefaultThemeVariants(this.theme, foam.__context__);
      });
    },

    function populateDefaultThemeVariants(theme, ctx) {
      // WARNING: IN DEVELOPMENT
      // SET useVariants TO TRUE ON THEME TO ENABLE MODE SWITCHING
      let fn = () => {
        if ( ! theme.useVariants ) return;
        // A scheme picked in-app wins over the OS setting; with no pick the
        // app follows the OS.
        let dark = this.colorScheme ? this.colorScheme === 'dark' : this.window.matchMedia('(prefers-color-scheme: dark)').matches;
        if ( dark ) {
          theme.activeVariants$set('color', 'dark');
        } else {
          theme.activeVariants$remove('color');
        }
      }
      // The previous theme's three inputs (OS query, in-app pick, variant
      // change) are held in one detachable so they go together.
      this.getPrivate_('variantInputs')?.detach();
      if ( ! theme.useVariants || ! this.window.matchMedia ) return;
      let mql    = this.window.matchMedia('(prefers-color-scheme: dark)');
      let inputs = foam.lang.FObject.create();
      mql.addEventListener('change', fn);
      inputs.onDetach(() => mql.removeEventListener('change', fn));
      inputs.onDetach(this.colorScheme$.sub(fn));
      inputs.onDetach(theme.activeVariants$.sub(() => { foam.u2.CSS.reloadStyles(ctx); }));
      this.setPrivate_('variantInputs', inputs);
      fn();
    },

    function getElementById(id) {
      return this.document.getElementById(id);
    },

    function getElementsByClassName(cls) {
      return this.document.getElementsByClassName(cls);
    },

    function debug() {
      this.console.debug.apply(this.console, arguments);
    },

    function error() {
      this.console.error.apply(this.console, arguments);
    },

    function info() {
      this.console.info.apply(this.console, arguments);
    },

    function log() {
      this.console.log.apply(this.console, arguments);
    },

    function warn() {
      this.console.warn.apply(this.console, arguments);
    },

    function async(l) {
      /* Decorate a listener so that the event is delivered asynchronously. */
      return this.delayed(l, 0);
    },

    function delayed(l, delay) {
      /* Decorate a listener so that events are delivered 'delay' ms later. */
      return () => {
        this.setTimeout(
          function() { l.apply(this, arguments); },
          delay);
      };
    },

    function merged(l, opt_delay) {
      var delay = opt_delay || 16;
      var ctx   = this;

      return foam.Function.setName(function() {
        var triggered = false;
        var lastArgs  = null;
        function mergedListener() {
          triggered = false;
          var args = Array.from(lastArgs);
          lastArgs = null;
          l.apply(this, args);
        }

        var f = function() {
          lastArgs = arguments;

          if ( ! triggered ) {
            triggered = true;
            ctx.setTimeout(mergedListener, delay);
          }
        };

        return f;
      }(), 'merged(' + l.name + ')');
    },

    function idled(l, opt_delay) {
      var delay = opt_delay || 16;
      var ctx   = this;

      return foam.Function.setName(function() {
        var lastArgs = null;
        var timeout;
        function idledListener() {
          timeout  = undefined;
          var args = Array.from(lastArgs);
          lastArgs = null;
          l.apply(this, args);
        }

        var f = function() {
          lastArgs = arguments;

          timeout && ctx.clearTimeout(timeout);
          timeout = ctx.setTimeout(idledListener, delay);
        };

        return f;
      }(), 'idled(' + l.name + ')');
    },

    function framed(l) {
      var ctx = this;

      return foam.Function.setName(function() {
        var triggered = false;
        var lastArgs  = null;
        function frameFired() {
          triggered = false;
          var args = lastArgs;
          lastArgs = null;
          l.apply(this, args);
        }

        var f = function framed() {
          lastArgs = arguments;

          if ( ! triggered ) {
            triggered = true;
            ctx.requestAnimationFrame(frameFired);
          }
        };

        return f;
      }(), 'framed(' + l.name + ')');
    },

    function setTimeout(f, t) {
      return this.window.setTimeout(f, t);
    },
    function clearTimeout(id) {
      this.window.clearTimeout(id);
    },

    function setInterval(f, t) {
      return this.window.setInterval(f, t);
    },
    function clearInterval(id) {
      this.window.clearInterval(id);
    },

    function requestAnimationFrame(f) {
      return this.window.requestAnimationFrame(f);
    },
    function cancelAnimationFrame(id) {
      this.window.cancelAnimationFrame(id);
    },

    function installCSS(text, /* optional */ owner, /* optional */ id) {
      this.document && this.document.head && this.document.head.insertAdjacentHTML(
        'beforeend',
        '<style' +
        (id    ? (' id="'    + id    + '"') : '') +
        (owner ? (' owner="' + owner + '"') : '') +
        '>' +
        text + '</style>');
    },

    function returnExpandedCSS(a) {
      /* Fallback function for using long form color MACROS in non-core apps */
      return a;
    }
  ]
});


foam.CLASS({
  package: 'foam.lang',
  name: 'WindowNodeJSRefinement',
  refines: 'foam.lang.Window',
  flags: [ 'node' ],
  methods: [
    function requestAnimationFrame(f) {
      return this.setTimeout(f, 16);
    },
    function cancelAnimationFrame(id) {
      this.clearTimeout(id);
    }
  ]
});


// Replace top-level Context with one which includes Window's exports.
foam.SCRIPT({
  package: 'foam.lang',
  name: 'WindowScript',
  requires: [
    'foam.lang.Window',
  ],
  code: function() {
    foam.__context__ = foam.lang.Window.create(
      { window: globalThis },
      foam.__context__
    ).__subContext__;
  }
});
