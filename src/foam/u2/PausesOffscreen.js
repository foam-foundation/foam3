/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'PausesOffscreen',

  documentation: `
    Mix-in for an Element which suspends timer-driven work while it is scrolled
    out of the viewport, and resumes it when it scrolls back in.

    It watches itself with an IntersectionObserver and exports decorated
    versions of the Window timer API into its sub-Context. Because every View
    created beneath an Element is created in that sub-Context, and because
    isMerged:/isIdled:/isFramed: listeners resolve merged/idled/framed from
    their own Context (foam/lang/Listener.js:126), all animation driven through
    those helpers pauses along with the raw timers.

      setTimeout()          real timer still runs, but a callback which comes
                            due while off-screen is queued and delivered on
                            the way back in
      setInterval()         cancelled on the way out, re-registered on the way
                            back in; missed ticks are not replayed
      requestAnimationFrame no frame is requested while off-screen; the
                            callback is re-requested on the way back in

    Browsers already throttle background *tabs*. They do not throttle an
    element which is merely scrolled out of view, which is what this covers.

    Must be mixed in alongside foam.lang.Timers, which supplies the derived
    merged/idled/framed_/async/delayed helpers exported here:

      implements: [ 'foam.lang.Timers', 'foam.u2.PausesOffscreen' ]

    Note that the mixing class's OWN listeners are not paused - a Listener
    resolves its decorator from __context__, not from the __subContext__ these
    exports live in. That is deliberate: a class which renders itself from a
    framed listener would otherwise never lay out, so would never gain the box
    the IntersectionObserver needs.

    Caveat: this can only intercept timers reached through the Context. Code
    calling the global setTimeout()/requestAnimationFrame() directly is
    unaffected, and should be switched to the imported versions.
  `,

  imports: [
    'cancelAnimationFrame  as cancelAnimationFrame_',
    'clearInterval         as clearInterval_',
    'clearTimeout          as clearTimeout_',
    'requestAnimationFrame as requestAnimationFrame_',
    'setInterval           as setInterval_',
    'setTimeout            as setTimeout_'
  ],

  exports: [
    'async',
    'cancelAnimationFrame',
    'clearInterval',
    'clearTimeout',
    'delayed',
    'framed_ as framed',
    'idled',
    'merged',
    'requestAnimationFrame',
    'setInterval',
    'setTimeout',
    'visible'
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'visible',
      value: true,
      documentation: `
        True while this Element intersects the viewport.

        Defaults to true so that an Element whose DOM node never makes it into
        the document keeps running rather than stalling forever. An off-screen
        Element corrects this on the IntersectionObserver's initial callback.
      `,
      postSet: function(_, visible) {
        visible ? this.resume_() : this.suspend_();
      }
    },
    {
      class: 'String',
      name: 'rootMargin',
      value: '200px',
      documentation: `
        IntersectionObserver rootMargin. Grows the viewport for the purposes of
        the visibility test, so content resumes just before it scrolls into
        view rather than visibly stalling on arrival.
      `
    },
    {
      name: 'timers_',
      hidden: true,
      transient: true,
      documentation: 'Virtual timer id -> record. See setTimeout().',
      factory: function() { return new Map(); }
    },
    {
      class: 'Int',
      name: 'nextId_',
      hidden: true,
      transient: true
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.onDetach(this.clearAll_.bind(this));
      this.observe_();
    },

    async function observe_() {
      var el = await this.el();
      if ( ! el ) return;

      var observer = new IntersectionObserver(
        entries => { this.visible = entries[entries.length-1].isIntersecting; },
        { rootMargin: this.rootMargin });

      observer.observe(el);
      this.onDetach(() => observer.disconnect());
    },

    function setTimeout(f, t) {
      /*
        Timer ids are ours, not the browser's, because a suspended interval is
        really cleared and re-registered, so its browser id changes underneath
        an id the caller is still holding. An id we don't recognize is passed
        through to the undecorated timer, for ids obtained outside the Context.
      */
      var id = ++this.nextId_;
      var r  = { f: f };

      r.realId = this.setTimeout_(() => {
        r.realId = 0;
        if ( this.visible ) {
          this.timers_.delete(id);
          f();
        } else {
          // Off-screen: hold the callback until we're back in view.
          r.due = true;
        }
      }, t);

      this.timers_.set(id, r);
      return id;
    },

    function clearTimeout(id) {
      var r = this.timers_.get(id);
      if ( ! r ) { this.clearTimeout_(id); return; }
      this.timers_.delete(id);
      if ( r.realId ) this.clearTimeout_(r.realId);
    },

    function setInterval(f, t) {
      var id = ++this.nextId_;
      var r  = { f: f, delay: t, interval: true, realId: 0 };

      this.timers_.set(id, r);
      if ( this.visible ) r.realId = this.setInterval_(f, t);
      return id;
    },

    function clearInterval(id) {
      var r = this.timers_.get(id);
      if ( ! r ) { this.clearInterval_(id); return; }
      this.timers_.delete(id);
      if ( r.realId ) this.clearInterval_(r.realId);
    },

    function requestAnimationFrame(f) {
      var id = ++this.nextId_;
      var r  = { f: f, frame: true, realId: 0 };

      this.timers_.set(id, r);
      if ( this.visible ) this.requestFrame_(id, r);
      else                r.due = true;
      return id;
    },

    function cancelAnimationFrame(id) {
      var r = this.timers_.get(id);
      if ( ! r ) { this.cancelAnimationFrame_(id); return; }
      this.timers_.delete(id);
      if ( r.realId ) this.cancelAnimationFrame_(r.realId);
    },

    function requestFrame_(id, r) {
      r.realId = this.requestAnimationFrame_(ts => {
        r.realId = 0;
        if ( this.visible ) {
          this.timers_.delete(id);
          r.f(ts);
        } else {
          r.due = true;
        }
      });
    },

    function suspend_() {
      /* Going off-screen: stop intervals and drop any pending frame. */
      for ( const r of this.timers_.values() ) {
        if ( ! r.realId ) continue;
        if ( r.interval ) {
          this.clearInterval_(r.realId);
          r.realId = 0;
        } else if ( r.frame ) {
          this.cancelAnimationFrame_(r.realId);
          r.realId = 0;
          r.due    = true;
        }
        // Timeouts are left running; their callback queues itself if it comes
        // due while we're off-screen.
      }
    },

    function resume_() {
      /*
        Coming back on-screen: deliver what came due, re-arm what we stopped.
        Iterate a snapshot, since delivering a callback can register new timers.
      */
      for ( const [ id, r ] of Array.from(this.timers_) ) {
        if ( r.due ) {
          r.due = false;
          if ( r.frame ) {
            this.requestFrame_(id, r);
          } else {
            this.timers_.delete(id);
            r.f();
          }
        } else if ( r.interval && ! r.realId ) {
          r.realId = this.setInterval_(r.f, r.delay);
        }
      }
    },

    function clearAll_() {
      /* Drop every timer, queued or running. */
      for ( const r of this.timers_.values() ) {
        if ( ! r.realId ) continue;
        if      ( r.interval ) this.clearInterval_(r.realId);
        else if ( r.frame )    this.cancelAnimationFrame_(r.realId);
        else                   this.clearTimeout_(r.realId);
      }
      this.timers_.clear();
    }
  ]
});
