/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.borders',
  name: 'VisibilityBorder',
  extends: 'foam.u2.Element',

  implements: [ 'foam.lang.Timers', 'foam.u2.PausesOffscreen' ],

  documentation: `
    A Border which suspends its contents' timers and animations while they are
    scrolled out of the viewport.

    All of the behaviour is in foam.u2.PausesOffscreen - this just makes it
    available as a plain wrapper, for content which isn't itself written to
    pause. FoamTagLoader wraps a <foam> tag in one when the tag carries
    pauseoffscreen; foam.core.reflow.example.Example mixes the behaviour in
    directly instead.

    Deliberately renders no CSS of its own: 'display: contents' would make this
    layout-neutral, but it would also leave the Border with an empty box, which
    an IntersectionObserver reports as permanently off-screen.
  `
});
