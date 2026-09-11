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
    ApplicationController.onClientLoad when the page is not running foam-bin.

    What it cannot do, and says so in the console: a file that defines a
    foam.SCRIPT, a class in foam.lang, and an instance rendered through a
    SlotNode all ask for a page reload.`,

  imports: [
    'document',
    'sourceChangeDAO?'
  ],

  properties: [
    {
      name: 'root',
      documentation: 'Element whose subtree holds the views to rebuild; the ApplicationController in an app.'
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

    function isCssOnly(oldCls, newCls) {
      /* True when the two models differ in css: and nothing else. The css
         postSet pushes a foam.u2.CSS axiom into axioms_, so that is
         stripped too. swapCSS rewrites in place by matching axioms
         index-for-index, which only makes sense when the two classes
         carry the same NUMBER of own css axioms -- gaining a first css:
         block (0 -> 1), or a mixins: change that adds or drops one, has
         nothing to match against, so those are excluded here and fall
         through to cascade/rebuild instead, where a fresh instance
         installs its own style block normally. */
      if ( oldCls.getOwnAxiomsByClass(foam.u2.CSS).length !==
           newCls.getOwnAxiomsByClass(foam.u2.CSS).length ) {
        return false;
      }
      var strip = cls => {
        var m = { ...cls.model_.instance_ };
        delete m.css;
        delete m.order;
        delete m.source;
        m.axioms_ = (m.axioms_ || []).filter(a => ! foam.u2.CSS.isInstance(a));
        return foam.json.Compact.stringify(m);
      };
      return oldCls.model_.css !== newCls.model_.css &&
        strip(oldCls) === strip(newCls);
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

    function rebuild(ids) {
      /* Replace the topmost instances of the rebuilt classes under root. A
         SlotNode renders its value outside its parent's childNodes, so an
         instance found there is counted as skipped instead of replaced; its
         own children are still walked, since a skip means only that instance
         couldn't be swapped, not that its subtree is out of bounds. */
      var result = { rebuilt: 0, skipped: 0 };
      var visit  = e => {
        if ( ! e || typeof e === 'string' ) return;
        if ( e.cls_ && ids.includes(e.cls_.id) ) {
          if ( this.replace(e) ) { result.rebuilt++; return; }
          result.skipped++;
        }
        if ( foam.u2.SlotNode.isInstance(e) ) { visit(e.node); return; }
        ( e.childNodes || [] ).forEach(visit);
      };
      visit(this.root);
      return result;
    },

    function replace(old) {
      /* Create the new-class twin of old with every property old set that its
         own class declares, excluded by NAME against foam.u2.Element (which
         also covers Node, its parent) rather than by sourceCls_: sourceCls_ is
         whichever class last installed the axiom, so a view that re-declares
         an Element-level name (controllerMode, shown, nodeName) would
         otherwise slip through and get linked to the old instance instead of
         running its own factory. hasOwnProperty is also true once a factory
         has materialized a value (Property.js:536), so a factory-backed
         property is pinned to old's value on reload, same as an explicitly
         set one. Properties are linked by slot so a data$ binding stays
         two-way through old, then swap it into the parent. */
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
      var newE = newCls.create(args, old.__context__);

      // What old's PARENT put on the host node -- addClass()/style() calls
      // made from outside old's own render, e.g. a grid-column a dashboard
      // sets per widget -- rather than old's own state, so it survives a
      // rebuild the same way it would survive nothing happening at all.
      // classes is a name->true map (Element2.js:644-649) and addClass
      // accepts multiple names (Element2.js:1144-1150); a name old's own
      // render also adds is a harmless repeat set on that map. css is a
      // name->resolved-value map (Element2.js:651-657): style_ writes the
      // CURRENT value there even for a slot-bound style (Element2.js:1559-
      // 1563), so a style bound to a slot is carried across as a snapshot,
      // not a live binding -- accepted here, since re-establishing the
      // binding would need the parent's own render, which this can't see.
      // A class name the edit removed from old's own render stays on the
      // rebuilt node until a page reload -- same reasoning: it isn't
      // information this method has. addClass() called with zero
      // arguments is not a no-op -- it adds newE's OWN default self-class
      // (Element2.js:1144-1150) -- so an empty classes map is skipped
      // rather than passed through.
      var oldClasses = Object.keys(old.classes);
      if ( oldClasses.length ) newE.addClass(...oldClasses);
      newE.style(old.css);
      for ( var i = 0 ; i < old.element_.attributes.length ; i++ ) {
        var a = old.element_.attributes[i];
        if ( a.name !== 'class' && a.name !== 'style' && a.name !== 'id' ) {
          newE.setAttribute(a.name, a.value);
        }
      }

      // old is kept alive on purpose, as the slot relay between new and
      // whatever old was linked to: replaceChild (Element2.js:1110-1123) has
      // already overwritten childNodes[i] with newE by the time it calls
      // oldE.remove(), so removeChild's search for old (Element2.js:1091-1108)
      // finds nothing and old.detach() never runs -- if it did, old's own
      // link to its data source would tear down and the chain would break.
      // removeChild's own `TODO: set c.parentNode to undefined` would break
      // this too, if ever acted on. old's listeners keep firing against
      // orphaned DOM, and each reload adds one more link; acceptable for a
      // dev-only tool. Do not add old.detach() here.
      parent.replaceChild(newE, old);
      return true;
    },

    function init() {
      if ( ! this.sourceChangeDAO ) {
        console.info('[reload] sourceChangeDAO not served, live reload off');
        return;
      }
      this.onDetach(this.sourceChangeDAO.listen(this.onChange));
    },

    function load(path, modified) {
      /* Re-run the file as a <script> tag so foam.CLASS sees
         document.currentScript.src and Model.source stays matchable. */
      return new Promise((resolve, reject) => {
        var s = this.document.createElement('script');
        s.src     = path + '?t=' + modified.getTime();
        s.onload  = () => { s.remove(); resolve(); };
        s.onerror = () => {
          s.remove();
          reject(new Error('reload failed to load ' + path));
        };
        this.document.head.appendChild(s);
      });
    },

    function swapCSS(oldCls, newCls) {
      /* Rewrite every installed <style> block that traces to one of
         oldCls's own css axioms, in place -- the same walk as
         CSS.reloadStyles (CSS.js:14-43) -- instead of matching by owner=id
         (installInClass installs a PARENT's axiom under the CREATING
         subclass's owner, CSS.js:87-107, so that drops an inherited block
         for good on a subclass edit and never reaches one on a base-class
         edit) or by sourceCls_ (a mixin installs the SAME axiom object into
         every class that mixes it in, Mixin.js:27-34, restamping
         sourceCls_ to whichever installed last -- it names no one class
         reliably).

         oldCls.getOwnAxiomsByClass(CSS) lists the css axioms actually
         installed into oldCls's own axiom map, in declaration order,
         whether from oldCls's own css: or a mixin it declares; newCls
         (freshly reloaded) lists the same axioms in the same order, so an
         entry's index in the old list is where its replacement lives in
         the new one. A shared mixin axiom sits at that same index in every
         class that mixes it in, so a match on a sibling's entry rewrites it
         with the text the mixin's own file currently holds -- identical
         unless that file is what got reloaded, in which case every mixer's
         block SHOULD move together. No entry is excluded by which class
         created it.

         The matched axiom's code (and expands_, an expression: derived from
         it -- CSS.js:55-61 -- recomputes on its own) is copied onto the
         EXISTING axiom object rather than swapping in newAxioms[i]: reload_
         keeps oldCls registered for a css-only id (nothing rebuilds), so a
         second edit's own-axiom list is still oldCls's -- if entry.axiom
         had been swapped to the first edit's new object, that second edit
         would find no match at all. No <style> element is added or
         removed. */
      var oldAxioms = oldCls.getOwnAxiomsByClass(foam.u2.CSS);
      var newAxioms = newCls.getOwnAxiomsByClass(foam.u2.CSS);
      if ( ! oldAxioms.length ) return;
      if ( oldAxioms.length !== newAxioms.length ) {
        console.warn('[reload] ' + newCls.id + ': css axiom count changed, skipping swapCSS');
        return;
      }

      var X      = this.__subContext__;
      var expand = X.returnExpandedCSS;
      var styles = this.document.installedStyles || {};

      Object.values(styles).forEach(map => {
        if ( Array.isArray(map) ) {
          var i = oldAxioms.indexOf(map[1]);
          if ( i < 0 ) return;
          var el = this.document.getElementById(map[0]);
          if ( el ) {
            el.textContent =
              expand(newAxioms[i].expandCSS(map[2], newAxioms[i].code, X));
          }
          map[1].code = newAxioms[i].code;
        } else {
          Object.values(map).forEach(entry => {
            var i = oldAxioms.indexOf(entry.axiom);
            if ( i < 0 ) return;
            var el = this.document.getElementById(entry.id);
            if ( el ) {
              el.textContent = expand(
                newAxioms[i].expandCSS(entry.cls, newAxioms[i].code, X));
            }
            entry.axiom.code = newAxioms[i].code;
          });
        }
      });
    },

    function reinstallCSS(oldCls, newCls) {
      /* Called between cascade and rebuild for a NON-css-only id (code
         changed too, so it is about to be rebuilt, not swapped): reuses
         the existing <style> block(s) instead of leaving the pre-edit
         ones live while rebuild() installs a second, duplicate block for
         the fresh instances it is about to create. A freshly reloaded
         class carries a freshly built css axiom with its own $UID
         (maybeInstallInDocument keys installedStyles by the INSTALLING
         axiom's $UID, CSS.js:66-85), so without this, a new instance's
         install finds nothing under that $UID and appends rather than
         reusing.

         Reuses swapCSS to rewrite the existing block(s) to the new text
         in place (same index-matched-by-identity logic, same "no <style>
         element added or removed" contract), then remaps each rewritten
         installedStyles entry from oldAxiom.$UID to newAxiom.$UID -- and
         re-points its axiom reference at newAxiom -- so a subsequent
         install under the new axiom's $UID finds the entry already there
         and skips, and so a THIRD edit's own-axiom match (which will
         compare against whatever is registered by then, i.e. newCls)
         still finds it.

         Returns false, doing nothing, when the axiom counts differ --
         same reason swapCSS itself refuses: nothing to index-match
         against. The caller hints a page reload in that case. */
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
      /* Put cls back as the live registration for id, and as the global
         accessor foam.<pkg>.<Name>: registerClassFactory (stdlib.js:
         1229-1246) defines that as a getter with no setter, so the plain
         assignment inside registerClass (stdlib.js:1214-1222) -- what
         register() below triggers -- is silently dropped once a lazy
         registration got there first. register() itself asserts when the
         cache already holds a different, non-factory value for the name
         (Context.js:157-164), so the entry a re-run foam.CLASS left behind
         is cleared first. */
      delete foam.__context__.__cache__[id];
      foam.__context__.register(cls);
      Object.defineProperty(
        foam.package.ensurePackage(globalThis, cls.package), cls.name,
        { value: cls, configurable: true });
    },

    async function reload_(path, modified) {
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
        await this.load(path, modified);

        var cssOnly = ids.filter(id =>
          olds[id] && this.isCssOnly(olds[id], foam.lookup(id)));
        cssOnly.forEach(id => this.swapCSS(olds[id], foam.lookup(id)));
        cssOnly.forEach(id => this.restore(id, olds[id]));

        var order  =
          this.cascade(ids.filter(id => ! cssOnly.includes(id)), path);

        // A code (and maybe css) edit: id is about to be rebuilt, so reuse
        // its existing style block(s) in place rather than leave the
        // pre-edit ones live under a fresh instance's duplicate install.
        // Only ids reloaded directly (olds[id] set) are handled here -- a
        // subclass cascade adds to order is rebuilt from its own unchanged
        // source, not from anything reload_ has an "old" reference for.
        var cssCountChanged = [];
        order.forEach(id => {
          if ( ! olds[id] ) return;
          if ( ! this.reinstallCSS(olds[id], foam.lookup(id)) ) {
            cssCountChanged.push(id);
          }
        });

        var result = this.rebuild(order);

        var hints = [];
        if ( foam.__SCRIPTS__.length > scripts ) {
          hints.push('the file defines a foam.SCRIPT');
        }
        ids.filter(id => id.startsWith('foam.lang.'))
          .forEach(id => hints.push(id + ' is a boot class'));
        if ( result.skipped ) {
          hints.push(result.skipped + ' instance(s) render through a SlotNode');
        }
        cssCountChanged.forEach(id =>
          hints.push(id + ' stylesheet count changed'));

        console.info('[reload] ' + path + ': ' + order.length + ' class(es) redefined, ' + cssOnly.length + ' stylesheet(s) swapped, ' + result.rebuilt + ' view(s) rebuilt' + ( hints.length ? '. Reload the page: ' + hints.join('; ') : '' ));
      } catch ( e ) {
        // A 404 or a throw partway leaves a reloaded id with nothing in the
        // cache; put back what reload_ found there before it ran.
        ids.forEach(id => {
          if ( olds[id] ) this.restore(id, olds[id]);
          else delete foam.__context__.__cache__[id];
        });
        console.error('[reload] ' + path + ' failed, old classes restored: ' + e.message + '. Reload the page.');
      }
    },

    function reload(path, modified) {
      /* Serializes overlapping reload() calls -- e.g. two rapid saves --
         through one promise chain instead of racing them. reload_ handles
         its own errors, so this chain never rejects and never drops a
         later call. */
      this.queue_ = this.queue_.then(() => this.reload_(path, modified));
      return this.queue_;
    }
  ],

  listeners: [
    function onChange(op, change) {
      /* FnSink shape from dao.listen(fn): (op, obj, sub). */
      if ( op === 'put' ) this.reload(change.id, change.modified);
    }
  ]
});
