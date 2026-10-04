/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.lang',
  name: 'Timers',

  documentation: `
    Mix-in supplying the listener-decorating timer helpers:
    async, delayed, merged, idled and framed_ (exported as 'framed').

    These are all written in terms of this.setTimeout() and
    this.requestAnimationFrame(), so any class which mixes this in and supplies
    those two primitives gets the derived helpers for free.

    foam.lang.Window supplies the real browser timers.
    foam.u2.borders.VisibilityBorder supplies versions which suspend while
    off-screen, so exporting these helpers from there transparently pauses
    every isMerged:/isIdled:/isFramed: listener created beneath it.
  `,

  methods: [
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

    function framed_(l) {
      /*
        Named framed_ rather than framed because foam.u2.Element imports
        'framed' (foam/u2/Element2.js:471). Method.installInProto assigns
        proto[name] (foam/lang/Method.js:211), and a plain assignment on a
        subclass prototype runs the inherited import's setter instead of
        creating an own property - so a method named 'framed' would silently
        fail to install on any Element subclass. Both Window and
        VisibilityBorder export this as 'framed'.
      */
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
    }
  ]
});
