/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.u2.test',
  name: 'ViewReloaderTest',
  extends: 'foam.core.test.JSTest',

  documentation: `ViewReloader (#5403): a changed path maps to the models that
    came from it, a css-only edit is told apart from a code edit, a reloaded
    base class drags its subclasses and refinements along, an on-screen
    view is replaced by an instance of the new class with its data link kept,
    a class/style/attribute the parent put on that view from outside its own
    render survives the swap, a subclass's css-only edit rewrites its own
    block in place without dropping an inherited one, a second css-only
    edit of the same class is picked up too rather than stuck on the
    first, restore() after a
    css-only reload puts the pre-edit class back as both the live
    registration and the global accessor, a mixin's shared css reaches
    every class that mixes it in without a sibling's own edit leaking onto
    it, gaining a first css: block is not treated as css-only and instead
    rebuilds so a fresh instance installs its own style block, a css+code
    edit reuses the existing style block for the rebuilt instance instead
    of leaving a stale one behind and installing a duplicate, an axiom-
    count change in the rebuild path is skipped rather than force-matched,
    and a reload that fails to load restores the class it cleared instead
    of leaving it unregistered.`,

  requires: [ 'foam.u2.ViewReloader' ],

  methods: [
    {
      name: 'runTest',
      code: async function(x) {
        var r = this.ViewReloader.create({}, x);

        // --- modelsFor: a model is found by the pathname of its source ---
        foam.CLASS({
          package: 'foam.u2.test',
          name: 'ReloaderProbe',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderProbe.js?t=1'
        });
        var found = r.modelsFor('/foam3/src/foam/u2/test/ReloaderProbe.js');
        x.test(found.length === 1 && found[0].id === 'foam.u2.test.ReloaderProbe',
          'modelsFor matches Model.source by pathname, ignoring the query, got ' + found.map(m => m.id));
        x.test(r.modelsFor('/foam3/src/foam/u2/test/Nope.js').length === 0,
          'modelsFor returns nothing for a path no model came from');

        // --- isCssOnly ---
        var base  = { package: 'foam.u2.test', name: 'CssProbe', extends: 'foam.u2.Element',
                      properties: [ 'a' ], css: '^ { color: $primary500; }' };
        var build = m => foam.lang.Model.create(m).buildClass();
        var c1    = build(base);
        var c2    = build({ ...base, css: '^ { color: $primary700; }' });
        var c3    = build({ ...base, css: '^ { color: $primary700; }', properties: [ 'a', 'b' ] });
        x.test(r.isCssOnly(c1, c2),   'a css-only edit is css-only');
        x.test(! r.isCssOnly(c1, c3), 'a css edit plus a property edit is not css-only');
        x.test(! r.isCssOnly(c1, c1), 'an unchanged model is not css-only');

        var noCss = { package: 'foam.u2.test', name: 'CssProbe',
                      extends: 'foam.u2.Element', properties: [ 'a' ] };
        var c4    = build(noCss);
        var c5    = build({ ...noCss, css: '^ { color: $primary500; }' });
        x.test(! r.isCssOnly(c4, c5),
          'gaining a css: block where there was none is not css-only');

        // --- cascade: subclass rebuilt, refinement from another file re-applied ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderBase', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderBase.js',
          methods: [ function version() { return 1; } ]
        });
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderChild', extends: 'foam.u2.test.ReloaderBase',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderChild.js'
        });
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderBaseRefinement', refines: 'foam.u2.test.ReloaderBase',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderBaseRefinement.js',
          methods: [ function refined() { return true; } ]
        });
        var oldChild = foam.lookup('foam.u2.test.ReloaderChild');
        x.test(oldChild.create(null, x).version() === 1 && oldChild.create(null, x).refined(),
          'setup: child sees base v1 and the refinement');

        // simulate the script re-run of ReloaderBase.js
        delete foam.__context__.__cache__['foam.u2.test.ReloaderBase'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderBase', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderBase.js?t=2',
          methods: [ function version() { return 2; } ]
        });
        var order = r.cascade([ 'foam.u2.test.ReloaderBase' ], '/foam3/src/foam/u2/test/ReloaderBase.js');
        x.test(order.join() === 'foam.u2.test.ReloaderBase,foam.u2.test.ReloaderChild',
          'cascade lists the reloaded class then its subclass, got ' + order.join());
        var newChild = foam.lookup('foam.u2.test.ReloaderChild');
        x.test(newChild !== oldChild, 'subclass was rebuilt');
        x.test(newChild.create(null, x).version() === 2, 'rebuilt subclass sees base v2');
        x.test(newChild.create(null, x).refined(), 'refinement from another file was re-applied to base v2');

        // --- rebuild: on-screen instance replaced, data link kept two-way ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderView', extends: 'foam.u2.View',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderView.js',
          methods: [ function version() { return 1; }, function render() { this.add(this.data$); } ]
        });
        foam.CLASS({ package: 'foam.u2.test', name: 'Holder', properties: [ 'data' ] });
        var holder = foam.u2.test.Holder.create({ data: 'first' }, x);

        var root  = foam.u2.Element.create(null, x);
        var oldV  = foam.u2.test.ReloaderView.create({ data$: holder.data$ }, x);
        root.add(oldV);
        var rr = this.ViewReloader.create({ root: root }, x);

        delete foam.__context__.__cache__['foam.u2.test.ReloaderView'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderView', extends: 'foam.u2.View',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderView.js?t=2',
          methods: [ function version() { return 2; }, function render() { this.add(this.data$); } ]
        });

        var res  = rr.rebuild([ 'foam.u2.test.ReloaderView' ]);
        var newV = root.childNodes[0];
        x.test(res.rebuilt === 1 && res.skipped === 0, 'one instance rebuilt, got ' + JSON.stringify(res));
        x.test(newV !== oldV && newV.version() === 2, 'the child is now an instance of the new class');
        x.test(newV.data === 'first', 'data value carried over');
        newV.data = 'second';
        x.test(holder.data === 'second', 'writing through the new view reaches the original holder');
        holder.data = 'third';
        x.test(newV.data === 'third', 'a holder write reaches the new view');
        x.test(! root.element_.contains(oldV.element_), 'old element left the DOM');

        // --- rebuild: what old's PARENT put on the host node -- a class,
        //     an inline style, a DOM attribute -- survives too, since
        //     replace() only knows old's own render, not what the parent
        //     did to it from outside (a dashboard's per-widget grid-column,
        //     for example) ---
        var root5 = foam.u2.Element.create(null, x);
        root5.start(foam.u2.test.ReloaderView, { data$: holder.data$ })
            .addClass('from-parent')
            .style({ 'grid-column': '3 / span 2' })
            .setAttribute('data-slot', 'a')
          .end();
        var rr5 = this.ViewReloader.create({ root: root5 }, x);

        delete foam.__context__.__cache__['foam.u2.test.ReloaderView'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderView', extends: 'foam.u2.View',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderView.js?t=4',
          methods: [ function version() { return 4; }, function render() { this.add(this.data$); } ]
        });

        rr5.rebuild([ 'foam.u2.test.ReloaderView' ]);
        var newV5 = root5.childNodes[0];
        x.test(newV5.classes['from-parent'] === true,
          'a class the parent added survives a rebuild');
        x.test(newV5.element_.style['grid-column'] === '3 / span 2',
          'an inline style the parent set survives a rebuild');
        x.test(newV5.element_.getAttribute('data-slot') === 'a',
          'a DOM attribute the parent set survives a rebuild');

        // an instance under a SlotNode is reported, not replaced
        var root2 = foam.u2.Element.create(null, x);
        var slot  = foam.lang.SimpleSlot.create({ value: foam.u2.test.ReloaderView.create({ data: 'x' }, x) });
        root2.add(slot);
        var rr2  = this.ViewReloader.create({ root: root2 }, x);
        var res2 = rr2.rebuild([ 'foam.u2.test.ReloaderView' ]);
        x.test(res2.rebuilt === 0 && res2.skipped === 1, 'a SlotNode-hosted instance is skipped and counted, got ' + JSON.stringify(res2));

        // a SlotNode-hosted instance is skipped, but its own child is still
        // walked and replaced
        var root3  = foam.u2.Element.create(null, x);
        var outer  = foam.u2.test.ReloaderView.create({ data: 'outer' }, x);
        var nested = foam.u2.test.ReloaderView.create({ data: 'inner' }, x);
        outer.add(nested);
        var slot3 = foam.lang.SimpleSlot.create({ value: outer });
        root3.add(slot3);
        var rr3 = this.ViewReloader.create({ root: root3 }, x);

        delete foam.__context__.__cache__['foam.u2.test.ReloaderView'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloaderView', extends: 'foam.u2.View',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/ReloaderView.js?t=3',
          methods: [ function version() { return 3; }, function render() { this.add(this.data$); } ]
        });

        var res3 = rr3.rebuild([ 'foam.u2.test.ReloaderView' ]);
        x.test(res3.rebuilt === 1 && res3.skipped === 1,
          'a SlotNode-hosted view is skipped but its own child is still replaced, got ' + JSON.stringify(res3));

        // --- replace: an Element-level property name re-declared by a
        //     subclass is still excluded by name, not sourceCls_ ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CMProbe', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CMProbe.js',
          properties: [
            { name: 'controllerMode', factory: function() { return foam.u2.ControllerMode.VIEW; } }
          ],
          methods: [ function version() { return 1; } ]
        });
        var root4 = foam.u2.Element.create(null, x);
        var oldCM = foam.u2.test.CMProbe.create({}, x);
        oldCM.controllerMode = foam.u2.ControllerMode.EDIT;
        root4.add(oldCM);
        var rr4 = this.ViewReloader.create({ root: root4 }, x);

        delete foam.__context__.__cache__['foam.u2.test.CMProbe'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CMProbe', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CMProbe.js?t=2',
          properties: [
            { name: 'controllerMode', factory: function() { return foam.u2.ControllerMode.VIEW; } }
          ],
          methods: [ function version() { return 2; } ]
        });

        rr4.rebuild([ 'foam.u2.test.CMProbe' ]);
        var newCM = root4.childNodes[0];
        x.test(newCM !== oldCM && newCM.version() === 2, 'CMProbe was rebuilt');
        x.test(newCM.controllerMode === foam.u2.ControllerMode.VIEW,
          'a redeclared Element-level property name is excluded by name, not sourceCls_, got ' + newCM.controllerMode);

        // --- swapCSS: a css-only edit of a subclass keeps the parent's
        //     installed style instead of dropping it. installInClass
        //     (CSS.js:87-107) installs the PARENT's css axiom under the
        //     CREATING subclass's owner, so an owner=id query can't tell
        //     the two blocks apart ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssBase', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssBase.js',
          css: '^ { opacity: 0.1; }'
        });
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssChild', extends: 'foam.u2.test.CssBase',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssChild.js',
          css: '^ { margin: 0; }'
        });
        var childId = 'foam.u2.test.CssChild';
        var oldChildCls = foam.u2.test.CssChild;
        oldChildCls.create({}, x);
        var before = document.querySelectorAll('style[owner="' + childId + '"]');
        x.test(before.length === 2,
          'setup: base and child css both installed under the child owner, got ' + before.length);

        delete foam.__context__.__cache__[childId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssChild', extends: 'foam.u2.test.CssBase',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssChild.js?t=2',
          css: '^ { margin: 1px; }'
        });
        r.swapCSS(oldChildCls, foam.lookup(childId));

        var after = document.querySelectorAll('style[owner="' + childId + '"]');
        x.test(after.length === before.length,
          'swapCSS adds and removes no <style> elements, got ' + after.length);
        var texts = Array.from(after).map(el => el.textContent);
        x.test(texts.some(t => t.includes('margin: 1px')), 'the child rule was rewritten to the new css');
        x.test(texts.some(t => t.includes('opacity: 0.1')), 'the inherited parent rule survived the child edit');

        // --- swapCSS: a second css-only edit of the same class is picked
        //     up too, not stuck on the first. Copying the new code onto the
        //     EXISTING axiom object (rather than swapping the entry to the
        //     new axiom) keeps entry.axiom identity-equal to oldChildCls's
        //     own axiom across edits -- oldChildCls is reused unchanged
        //     here, matching what reload_ does: it keeps the pre-edit class
        //     registered for a css-only id, so the next edit's "old" is
        //     still this same object ---
        delete foam.__context__.__cache__[childId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssChild', extends: 'foam.u2.test.CssBase',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssChild.js?t=3',
          css: '^ { margin: 2px; }'
        });
        r.swapCSS(oldChildCls, foam.lookup(childId));

        var repeatTexts = Array.from(
          document.querySelectorAll('style[owner="' + childId + '"]'))
          .map(el => el.textContent);
        x.test(repeatTexts.some(t => t.includes('margin: 2px')),
          'a second css-only edit of the same class is picked up');
        x.test(! repeatTexts.some(t => t.includes('margin: 1px')),
          'the second edit replaces the first, not appends to it');

        // --- restore: after a css-only reload -- swapCSS above left
        //     foam.lookup(childId) and the global foam.u2.test.CssChild
        //     both pointing at the freshly redefined class, same as
        //     reload_ would see before calling restore() -- restore puts
        //     oldChildCls back as BOTH: the cache (Context.register) and
        //     the global accessor (Object.defineProperty), not just one ---
        r.restore(childId, oldChildCls);
        x.test(foam.u2.test.CssChild === oldChildCls &&
          foam.lookup('foam.u2.test.CssChild') === oldChildCls,
          'a css-only reload keeps the old class registered in both the context and the package global');

        // --- swapCSS: a class that mixes in a shared css axiom, and a
        //     reload of the mixin's own file reaching every class that
        //     mixes it in. Mixin.installInClass (Mixin.js:27-34) installs
        //     the SAME axiom object into every class that mixes it in, so
        //     a match on one mixer's entry during another mixer's reload
        //     rewrites it with the mixin file's current (unedited) text --
        //     a no-op -- while a reload of the mixin file itself needs
        //     that same match to reach every mixer ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssMixinProbe',
          css: '^ { padding: 0; }'
        });
        foam.CLASS({
          package: 'foam.u2.test', name: 'MixA', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/MixA.js',
          mixins: [ 'foam.u2.test.CssMixinProbe' ],
          css: '^ { opacity: 0.2; }'
        });
        foam.CLASS({
          package: 'foam.u2.test', name: 'MixB', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/MixB.js',
          mixins: [ 'foam.u2.test.CssMixinProbe' ],
          css: '^ { opacity: 0.3; }'
        });
        var mixAId = 'foam.u2.test.MixA';
        var mixBId = 'foam.u2.test.MixB';
        var oldMixA = foam.lookup(mixAId);
        oldMixA.create({}, x);
        foam.lookup(mixBId).create({}, x);

        var mixBBefore = document.querySelectorAll('style[owner="' + mixBId + '"]');
        var mixBTextsBefore = Array.from(mixBBefore).map(el => el.textContent);

        delete foam.__context__.__cache__[mixAId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'MixA', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/MixA.js?t=2',
          mixins: [ 'foam.u2.test.CssMixinProbe' ],
          css: '^ { opacity: 0.1; }'
        });
        r.swapCSS(oldMixA, foam.lookup(mixAId));

        var mixBAfter = document.querySelectorAll('style[owner="' + mixBId + '"]');
        x.test(mixBAfter.length === mixBBefore.length,
          'a MixA reload adds and removes no <style> element from MixB, got ' + mixBAfter.length);
        var mixBTextsAfter = Array.from(mixBAfter).map(el => el.textContent);
        x.test(JSON.stringify(mixBTextsAfter) === JSON.stringify(mixBTextsBefore),
          'MixB\'s own and mixin blocks are unchanged by a MixA reload');

        var mixATexts =
          Array.from(document.querySelectorAll('style[owner="' + mixAId + '"]'))
            .map(el => el.textContent);
        x.test(mixATexts.some(t => t.includes('opacity: 0.1')), 'MixA\'s own block picked up the new css');
        x.test(mixATexts.some(t => t.includes('padding: 0')), 'MixA\'s mixin block still has the shared rule');

        var oldMixinProbe = foam.lookup('foam.u2.test.CssMixinProbe');
        delete foam.__context__.__cache__['foam.u2.test.CssMixinProbe'];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssMixinProbe',
          css: '^ { padding: 1px; }'
        });
        r.swapCSS(oldMixinProbe, foam.lookup('foam.u2.test.CssMixinProbe'));

        var mixATextsAfterMixinEdit = Array.from(
          document.querySelectorAll('style[owner="' + mixAId + '"]'))
          .map(el => el.textContent);
        var mixBTextsAfterMixinEdit = Array.from(
          document.querySelectorAll('style[owner="' + mixBId + '"]'))
          .map(el => el.textContent);
        x.test(mixATextsAfterMixinEdit.some(t => t.includes('padding: 1px')),
          'a mixin-file edit reaches the mixin block under MixA\'s owner');
        x.test(mixBTextsAfterMixinEdit.some(t => t.includes('padding: 1px')),
          'a mixin-file edit reaches the mixin block under MixB\'s owner too');

        // --- integration: a class gaining a css: block is rebuilt (not
        //     silently dropped as a no-op "swap"), and the rebuilt
        //     instance installs a fresh style block ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssGrowView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssGrowView.js'
        });
        var growId   = 'foam.u2.test.CssGrowView';
        var oldGrow  = foam.lookup(growId);
        var rootGrow = foam.u2.Element.create(null, x);
        rootGrow.add(oldGrow.create({}, x));
        var rrGrow = this.ViewReloader.create({ root: rootGrow }, x);

        delete foam.__context__.__cache__[growId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssGrowView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssGrowView.js?t=2',
          css: '^ { opacity: 0.4; }'
        });
        x.test(! rrGrow.isCssOnly(oldGrow, foam.lookup(growId)),
          'gaining a css: block where there was none is not css-only (via isCssOnly)');

        var growOrder = rrGrow.cascade([ growId ],
          '/foam3/src/foam/u2/test/CssGrowView.js');
        x.test(growOrder.includes(growId), 'the class is rebuilt, not skipped as a css swap');
        x.test(rrGrow.reinstallCSS(oldGrow, foam.lookup(growId)),
          'reinstallCSS is a no-op (returns true) when the old class had no css to reconcile');
        rrGrow.rebuild(growOrder);

        x.test(document.querySelectorAll('style[owner="' + growId + '"]').length === 1,
          'the rebuilt instance installs a fresh style block');

        // --- integration: a css+code edit reuses the existing <style>
        //     block for the rebuilt instance instead of leaving the
        //     pre-edit block live and installing a duplicate ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssCodeView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssCodeView.js',
          css: '^ { opacity: 0.5; }',
          methods: [ function version() { return 1; } ]
        });
        var codeId   = 'foam.u2.test.CssCodeView';
        var oldCode  = foam.lookup(codeId);
        var rootCode = foam.u2.Element.create(null, x);
        rootCode.add(oldCode.create({}, x));
        var rrCode = this.ViewReloader.create({ root: rootCode }, x);

        delete foam.__context__.__cache__[codeId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssCodeView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssCodeView.js?t=2',
          css: '^ { opacity: 0.6; }',
          methods: [ function version() { return 2; } ]
        });
        x.test(! rrCode.isCssOnly(oldCode, foam.lookup(codeId)),
          'a css edit plus a code edit is not css-only');

        var codeOrder = rrCode.cascade([ codeId ],
          '/foam3/src/foam/u2/test/CssCodeView.js');
        x.test(rrCode.reinstallCSS(oldCode, foam.lookup(codeId)),
          'matching axiom counts: reinstallCSS handles the edit in place');
        rrCode.rebuild(codeOrder);

        var codeBlocks = document.querySelectorAll('style[owner="' + codeId + '"]');
        x.test(codeBlocks.length === 1,
          'no duplicate <style> block after a css+code rebuild, got ' + codeBlocks.length);
        var codeTexts = Array.from(codeBlocks).map(el => el.textContent);
        x.test(codeTexts.some(t => t.includes('opacity: 0.6')),
          'the existing block shows the new css');
        x.test(! codeTexts.some(t => t.includes('opacity: 0.5')),
          'the old css text is gone, not layered underneath');

        // --- integration: an axiom-count change in the rebuild path is
        //     skipped by reinstallCSS, not force-matched ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssCountView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssCountView.js',
          css: '^ { opacity: 0.5; }'
        });
        var countId  = 'foam.u2.test.CssCountView';
        var oldCount = foam.lookup(countId);
        delete foam.__context__.__cache__[countId];
        foam.CLASS({
          package: 'foam.u2.test', name: 'CssCountView', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/CssCountView.js?t=2',
          methods: [ function extra() { return true; } ]
        });
        x.test(! rrCode.reinstallCSS(oldCount, foam.lookup(countId)),
          'reinstallCSS returns false, doing nothing, when the axiom count changed');

        // --- reload: a failed load restores the old class instead of
        //     leaving the id unregistered ---
        foam.CLASS({
          package: 'foam.u2.test', name: 'ReloadFailProbe', extends: 'foam.u2.Element',
          source: 'http://localhost:8080/foam3/src/foam/u2/test/NoSuchFile.js'
        });
        var beforeFail = foam.lookup('foam.u2.test.ReloadFailProbe');
        var threw = false;
        try {
          await r.reload('/foam3/src/foam/u2/test/NoSuchFile.js', new Date());
        } catch ( e ) {
          threw = true;
        }
        x.test(! threw, 'reload does not throw when the file fails to load');
        x.test(foam.lookup('foam.u2.test.ReloadFailProbe') === beforeFail,
          'a failed reload restores the old class instead of leaving the cache empty');
      }
    }
  ]
});
