/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2',
  name: 'ViewReloader',

  documentation: `Dev-only. Picks up a .js edit without a page reload (#5403).
    Listens on sourceChangeDAO (fed by foam.core.fs.SourceWatcher), re-runs the
    changed file as a <script> tag after clearing its classes from the context
    cache, then either swaps the stylesheet when only css: changed or replaces
    on-screen instances of the rebuilt classes in place. Created by
    ApplicationController.onClientLoad, which hands itself over as root; the
    class is built under dev&web, so a foam-bin build never carries it.

    Instances are looked for under every Element loaded as a root of its own:
    the ApplicationController, and any Popup or ModalOverlay open beside it.
    init() creates document.u2Roots, which Element.load then adds to and
    Element.detach removes from; no build without a ViewReloader keeps the
    set, so nothing is retained in production. The controller loaded before
    this existed, so init() adds root by hand.

    What it cannot do, and says so in the console: a file that defines a
    foam.SCRIPT, a class in foam.lang, an instance rendered through a
    SlotNode, an instance that is itself a root, and a file holding only
    refinements or a mixin all ask for a page reload.`,

  imports: [
    'document',
    'sourceChangeDAO'
  ],

  properties: [
    {
      name: 'root',
      documentation: 'An Element loaded before document.u2Roots existed, added to it by init(): the ApplicationController.'
    },
    {
      name: 'queue_',
      hidden: true,
      transient: true,
      documentation: 'Promise chain serializing overlapping reload() calls, so two rapid saves run one after another instead of racing.',
      factory: function() { return Promise.resolve(); }
    }
  ],

  methods: [
    function pathOf(source) {
      /* Pathname of a Model.source URL, without the ?t= query a reload adds. */
      return source ? new URL(source).pathname : '';
    },

    function modelsFor(path) {
      /* Models defined by the file at path. foam.CLASS stamps Model.source with
         document.currentScript.src (EndBoot.js), so the models know. */
      return Object.values(foam.USED).concat(Object.values(foam.UNUSED))
        .filter(m => this.pathOf(m.source) === path);
    },

    function stripped(cls) {
      /* The model as text, minus css:, the foam.u2.CSS axiom the css postSet
         pushes into axioms_, and the two fields every reload changes. */
      var m = { ...cls.model_.instance_ };
      delete m.css;
      delete m.order;
      delete m.source;
      m.axioms_ = (m.axioms_ || []).filter(a => ! foam.u2.CSS.isInstance(a));
      return foam.json.Compact.stringify(m);
    },

    function isUnchanged(oldCls, newCls) {
      /* True when the save changed nothing: a formatter run, or :w on an
         unchanged buffer. Nothing to swap or rebuild then. */
      return oldCls.model_.css === newCls.model_.css &&
        this.stripped(oldCls) === this.stripped(newCls);
    },

    function isCssOnly(oldCls, newCls) {
      /* True when the two models differ in css: and nothing else. swapCSS
         matches own css axioms index-for-index, so the counts must agree:
         gaining a first css: block, or a mixins: change that adds or drops
         one, falls through to cascade/rebuild, where a fresh instance
         installs its own style block normally. */
      if ( oldCls.getOwnAxiomsByClass(foam.u2.CSS).length !==
           newCls.getOwnAxiomsByClass(foam.u2.CSS).length ) {
        return false;
      }
      return oldCls.model_.css !== newCls.model_.css &&
        this.stripped(oldCls) === this.stripped(newCls);
    },

    function cascade(ids, path) {
      /* Rebuild every USED subclass of the reloaded ids, parents first, and
         re-apply every refinement of them that lives in another file (a
         refinement in the reloaded file already re-ran with it). Returns the
         full list of rebuilt ids. UNUSED models need nothing: their factory
         builds lazily against the new parent. */
      var used  = Object.values(foam.USED);
      var order = ids.slice();
      var set   = new Set(ids);
      for ( var grew = true ; grew ; ) {
        grew = false;
        used.forEach(m => {
          if ( ! m.refines && set.has(m.extends) && ! set.has(m.id) ) {
            set.add(m.id);
            order.push(m.id);
            grew = true;
          }
        });
      }
      order.forEach((id, i) => {
        if ( i >= ids.length ) {
          delete foam.__context__.__cache__[id];
          foam.CLASS(foam.USED[id]);
        }
        used
          .filter(m => m.refines === id && this.pathOf(m.source) !== path)
          .forEach(m => foam.CLASS(m));
      });
      return order;
    },

    function mixersOf(ids) {
      /* USED classes that mix in one of ids. cascade keys on extends only,
         so their instances are not rebuilt; the caller hints. */
      return Object.values(foam.USED)
        .filter(m => ( m.mixins || [] ).some(mx => ids.includes(mx.path)))
        .map(m => m.id);
    },

    function rebuild(ids) {
      /* Replace the topmost instances of the rebuilt classes under every
         root the document knows. An instance with no parent is a root
         itself (the controller, an open popup) and has nothing to be
         swapped into; one whose parent does not list it in childNodes is
         rendered through a SlotNode. Both are counted, not replaced, and
         their children are still walked. */
      var result = { rebuilt: 0, skipped: 0, roots: 0 };
      var visit  = e => {
        if ( ! e || typeof e === 'string' ) return;
        if ( e.cls_ && ids.includes(e.cls_.id) ) {
          if ( ! e.parentNode ) {
            result.roots++;
          } else if ( this.replace(e) ) {
            result.rebuilt++;
            return;
          } else {
            result.skipped++;
          }
        }
        if ( foam.u2.SlotNode.isInstance(e) ) { visit(e.node); return; }
        ( e.childNodes || [] ).forEach(visit);
      };
      ( this.document.u2Roots || [] ).forEach(visit);
      return result;
    },

    function replace(old) {
      /* Create the new-class twin of old with every property old set that its
         own class declares, linked by slot so a data$ binding stays two-way
         through old, then swap it into the parent. Excluded by NAME against
         foam.u2.Element (which covers Node too), not by sourceCls_: a view
         that re-declares an Element-level name would otherwise be pinned to
         old's value instead of running its own factory. hasOwnProperty is
         true once a factory has materialized a value, so a factory-backed
         property is carried over like an explicitly set one. */
      var parent = old.parentNode;
      if ( ! parent || ! parent.childNodes.includes(old) ) return false;

      var newCls = foam.lookup(old.cls_.id);
      var args   = {};
      old.cls_.getAxiomsByClass(foam.lang.Property).forEach(p => {
        if ( foam.u2.Element.getAxiomByName(p.name) ) return;
        if ( ! old.hasOwnProperty(p.name) ) return;
        if ( ! newCls.getAxiomByName(p.name) ) return;
        args[p.name + '$'] = old.slot(p.name);
      });
      // shown is Element-level, so the loop skips it, but a parent's
      // .show(cond$) follows into old's shown$ and the new instance must
      // hear the flip too. Its postSet owns the hidden class, so that one is
      // not copied below.
      args.shown$ = old.shown$;
      var newE = newCls.create(args, old.__context__);

      // What old's PARENT put on the host node from outside old's render
      // (a dashboard's per-widget grid column) survives, as a snapshot: a
      // slot-bound style is copied by value. addClass() with no arguments
      // adds newE's own self-class, so an empty list is skipped.
      var oldClasses = Object.keys(old.classes)
        .filter(c => c !== 'foam-u2-Element-hidden');
      if ( oldClasses.length ) newE.addClass(...oldClasses);
      newE.style(old.css);
      for ( var i = 0 ; i < old.element_.attributes.length ; i++ ) {
        var a = old.element_.attributes[i];
        if ( a.name !== 'class' && a.name !== 'style' && a.name !== 'id' ) {
          newE.setAttribute(a.name, a.value);
        }
      }

      // old stays alive as the slot relay between newE and old's data
      // source: replaceChild overwrites childNodes[i] before oldE.remove()
      // runs, so removeChild finds nothing and old.detach() never fires.
      // Do not add old.detach() here; it would tear the relay down.
      parent.replaceChild(newE, old);
      return true;
    },

    function init() {
      var roots = this.document.u2Roots || ( this.document.u2Roots = new Set() );
      if ( this.root ) roots.add(this.root);
      this.onDetach(this.sourceChangeDAO.listen(this.onChange));
    },

    function load(path) {
      /* Re-run the file as a <script> tag so foam.CLASS sees
         document.currentScript.src and Model.source stays matchable. The
         query string defeats the browser cache. */
      return new Promise((resolve, reject) => {
        var s = this.document.createElement('script');
        s.src     = path + '?t=' + Date.now();
        s.onload  = () => { s.remove(); resolve(); };
        s.onerror = () => {
          s.remove();
          reject(new Error('reload failed to load ' + path));
        };
        this.document.head.appendChild(s);
      });
    },

    function swapCSS(oldCls, newCls) {
      /* Copy newCls's css text onto oldCls's own css axioms, matched
         index-for-index (both callers have checked the counts agree), then
         let CSS.reloadStyles re-expand every installed <style> block from
         its axiom's current code, the same walk a theme change runs.

         Copied onto the EXISTING axiom object, not swapped for newAxioms[i]:
         reload_ keeps oldCls registered for a css-only id, so a second
         edit's own-axiom list is still oldCls's. A mixin installs the same
         axiom object into every class that mixes it in, so one match moves
         every mixer's block together. No <style> element is added or
         removed. */
      var oldAxioms = oldCls.getOwnAxiomsByClass(foam.u2.CSS);
      var newAxioms = newCls.getOwnAxiomsByClass(foam.u2.CSS);
      if ( ! oldAxioms.length ) return;
      oldAxioms.forEach((a, i) => { a.code = newAxioms[i].code; });
      foam.u2.CSS.reloadStyles(this.__subContext__);
    },

    function reinstallCSS(oldCls, newCls) {
      /* Called between cascade and rebuild for an id whose code changed:
         rewrites its existing <style> block(s) to the new text through
         swapCSS, then re-keys each installedStyles entry from the old
         axiom's $UID to the new one's, so a fresh instance's install finds
         the block already there instead of appending a duplicate under the
         pre-edit one. Returns false, doing nothing, when the axiom counts
         differ; the caller hints a page reload. */
      var oldAxioms = oldCls.getOwnAxiomsByClass(foam.u2.CSS);
      var newAxioms = newCls.getOwnAxiomsByClass(foam.u2.CSS);
      if ( ! oldAxioms.length ) return true;
      if ( oldAxioms.length !== newAxioms.length ) return false;

      this.swapCSS(oldCls, newCls);

      var styles = this.document.installedStyles || {};
      oldAxioms.forEach((oldAxiom, i) => {
        var entry = styles[oldAxiom.$UID];
        if ( ! entry ) return;
        delete styles[oldAxiom.$UID];
        if ( Array.isArray(entry) ) {
          entry[1] = newAxioms[i];
        } else {
          Object.values(entry).forEach(e => { e.axiom = newAxioms[i]; });
        }
        styles[newAxioms[i].$UID] = entry;
      });
      return true;
    },

    function restore(id, cls) {
      /* Put cls back as the live registration for id and as the global
         accessor foam.<pkg>.<Name>. The accessor is a getter with no setter
         once a lazy registration got there first, so registerClass's plain
         assignment is silently dropped and defineProperty is needed.
         register() asserts on a cache entry holding a different class, so
         the one the re-run foam.CLASS left is cleared first. */
      delete foam.__context__.__cache__[id];
      foam.__context__.register(cls);
      Object.defineProperty(
        foam.package.ensurePackage(globalThis, cls.package), cls.name,
        { value: cls, configurable: true });
    },

    async function reload_(path) {
      var models = this.modelsFor(path);
      if ( ! models.length ) {
        console.info('[reload] ' + path + ': no loaded class came from this file');
        return;
      }

      var ids  = models.filter(m => ! m.refines).map(m => m.id);
      var olds = {};
      ids.forEach(id => {
        olds[id] = foam.__context__.isDefined(id) ? foam.lookup(id) : null;
        delete foam.__context__.__cache__[id];
      });
      var scripts = foam.__SCRIPTS__.length;

      try {
        await this.load(path);

        var same = ids.filter(id =>
          olds[id] && this.isUnchanged(olds[id], foam.lookup(id)));
        same.forEach(id => this.restore(id, olds[id]));

        var cssOnly = ids.filter(id => ! same.includes(id) &&
          olds[id] && this.isCssOnly(olds[id], foam.lookup(id)));
        cssOnly.forEach(id => this.swapCSS(olds[id], foam.lookup(id)));
        cssOnly.forEach(id => this.restore(id, olds[id]));

        var order = this.cascade(
          ids.filter(id => ! same.includes(id) && ! cssOnly.includes(id)), path);

        var hints = [];

        // Only ids reloaded directly (olds[id] set) have a pre-edit class to
        // reconcile against; a subclass cascade added is rebuilt from its own
        // unchanged source.
        order.forEach(id => {
          if ( olds[id] && ! this.reinstallCSS(olds[id], foam.lookup(id)) ) {
            hints.push(id + ' stylesheet count changed');
          }
        });

        var result = this.rebuild(order);

        if ( foam.__SCRIPTS__.length > scripts ) {
          hints.push('the file defines a foam.SCRIPT');
        }
        ids.filter(id => id.startsWith('foam.lang.'))
          .forEach(id => hints.push(id + ' is a boot class'));
        if ( ! ids.length ) {
          hints.push('the file holds only refinements; existing instances were not rebuilt');
        }
        var mixers = this.mixersOf(order);
        if ( mixers.length ) {
          hints.push(mixers.length + ' class(es) mix this in; their instances were not rebuilt');
        }
        if ( result.roots ) {
          hints.push(result.roots + ' instance(s) are a root themselves (the controller or an open popup)');
        }
        if ( result.skipped ) {
          hints.push(result.skipped + ' instance(s) render through a SlotNode');
        }

        console.info('[reload] ' + path + ': ' + order.length + ' class(es) redefined, ' + cssOnly.length + ' stylesheet(s) swapped, ' + result.rebuilt + ' view(s) rebuilt' + ( same.length ? ', ' + same.length + ' unchanged' : '' ) + ( hints.length ? '. Reload the page: ' + hints.join('; ') : '' ));
      } catch ( e ) {
        // A 404 or a throw partway leaves a reloaded id with nothing in the
        // cache; put back what reload_ found there before it ran.
        ids.forEach(id => {
          if ( olds[id] ) this.restore(id, olds[id]);
          else delete foam.__context__.__cache__[id];
        });
        console.error('[reload] ' + path + ' failed, old classes restored: ' + e.message + '. Fix the file and save again, or reload the page.');
      }
    },

    function reload(path) {
      /* Serializes overlapping reload() calls -- e.g. two rapid saves --
         through one promise chain instead of racing them. reload_ handles
         its own errors, so this chain never rejects and never drops a
         later call. */
      this.queue_ = this.queue_.then(() => this.reload_(path));
      return this.queue_;
    }
  ],

  listeners: [
    function onChange(op, change) {
      /* FnSink shape from dao.listen(fn): (op, obj, sub). */
      if ( op === 'put' ) this.reload(change.id);
    }
  ]
});
