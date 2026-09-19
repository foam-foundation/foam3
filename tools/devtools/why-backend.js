/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers 'why': for the current target (selection-backend.js), replay
// every client-side gate (why-core.js, tested) with the page's real
// evaluators, and report the permission cache. Browser-only glue.
(function() {
  var D = window.__foamDevtools, W = window.__foamWhyCore, P = window.__foamShapers;

  // Client auth is a decorator stack (AuthorizeAnonymousClientDecorator ->
  // CachedAuthServiceProxy -> ClientLoginAuthService); apps may re-stack it,
  // so walk .delegate until the object with the cache map appears.
  function authCache() {
    var a = currentAuth, hops = 0;
    while ( a && hops < 10 ) {
      if ( a.cache && typeof a.cache === 'object' ) return a.cache;
      a = a.delegate; hops++;
    }
    return null;
  }

  // Promises the page hands back (auth.check results, async isAvailable),
  // settled once each. Keyed by the promise itself, so a permission answer
  // lives exactly as long as FOAM's own cache entry: CachedAuthServiceProxy
  // returns the same promise for a name until it resets on group/subject/
  // login change or a capability junction put (CachedAuthServiceProxy.js:36-56).
  var settled = new WeakMap();
  function settle(p) {
    if ( settled.has(p) ) return settled.get(p);
    p.then(function(v) { settled.set(p, !! v); }, function() { settled.set(p, false); });
    return 'pending';
  }

  // FOAM asks the auth in the record's own context (Element2.js:1889-1890);
  // with none, every permission-gated property is HIDDEN. Actions and
  // sections skip permission checks entirely without an auth (Action.js:218).
  var currentAuth = null;
  function permOf(name) {
    if ( ! currentAuth ) return false;
    var p;
    try { p = currentAuth.check(null, name); } catch (e) { return false; }
    if ( ! p || typeof p.then !== 'function' ) return !! p;
    return settle(p);
  }

  var env = {
    // withArgs is what FOAM's own slots use (Action.js:253); a thenable result
    // means "not yet" until it lands (PromiseSlot, Slot.js:578-586).
    evalFn: function(fn, data) {
      var r;
      try { r = foam.Function.withArgs(fn, data, data); }
      catch (e) { return { err: String(e && e.message).slice(0, 80) }; }
      return ( r && typeof r.then === 'function' ) ? settle(r) : r;
    },
    slotGet: function(s) { try { return s.get(); } catch (e) { return 'ERR'; } },
    perm: permOf
  };

  function str(v, max) { var s = String(v); return s.length > max ? s.slice(0, max) + '…' : s; }

  // What the panel polls to notice navigation: the route plus the stack
  // position (a push/back within the same hash still changes pos).
  D.register('screenKey', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var pos = -1;
    try { pos = ctrl.stack ? ctrl.stack.pos : -1; } catch (e) {}
    return { key: location.hash + '|' + pos + '|' + D.selectionGen() };
  });

  D.register('why', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var t = D.currentTarget();
    if ( ! t ) return { error: D.NO_RECORD };
    if ( t.table ) {
      var of = t.table.dao.of;
      return { error: 'this screen is a table of ' + ( of ? of.id : 'records' ) + ' — open a record, or select a row in Elements' };
    }
    D.publishHandles(t);
    var data = t.data, cls = data.cls_;
    try { currentAuth = ( data.__subContext__ && data.__subContext__.auth ) || null; } catch (e) { currentAuth = null; }
    // No controllerMode in scope is what FOAM turns into CREATE (Element2.js:569).
    var mode = t.mode || null, modeName = mode || 'CREATE';

    var properties = cls.getAxiomsByClass(foam.lang.Property).map(function(p) {
      try { return W.propGate(p, modeName, data, env); }
      catch (e) { return { name: p.name, label: p.name, hidden: false, base: { source: 'default', kind: 'value', mode: 'ERR', err: str(e.message, 80) }, clamp: 'ERR', perm: null, final: 'ERR' }; }
    });

    var validation = [];
    try {
      ( data.errors_ || [] ).forEach(function(e) {
        var prop = e[0], v;
        try { v = str(prop.f ? prop.f(data) : data[prop.name], 60); } catch (err) { v = 'ERR'; }
        validation.push({ name: prop.name || String(prop), value: v, message: str(e[1], 160) });
      });
    } catch (e) { validation.push({ name: '(errors_)', value: '', message: 'threw: ' + str(e.message, 100) }); }

    var actions = cls.getAxiomsByClass(foam.lang.Action).map(function(a) {
      var running = false;
      try { running = !! a.getRunning$(data).get(); } catch (e) {}
      return W.actionGate(a, data, env, running);
    });

    // A section is also unavailable when every property in it is HIDDEN
    // (SectionAxiom.js:125-165); members come from its explicit `properties`
    // list or from each property's `section` (SectionAxiom.js:108-123).
    var propAxioms = cls.getAxiomsByClass(foam.lang.Property), sectionOf = {};
    propAxioms.forEach(function(p) { try { sectionOf[p.name] = p.section || null; } catch (e) {} });
    var sections = ( foam.layout && foam.layout.SectionAxiom )
      ? cls.getAxiomsByClass(foam.layout.SectionAxiom).map(function(s) {
          return W.sectionGate(s, data, env, properties, function(n) { return sectionOf[n]; });
        })
      : [];

    var cache = authCache(), permissions = [];
    if ( cache ) Object.keys(cache).forEach(function(k) { permissions.push({ perm: k, result: permOf(k) }); });

    var pending = 0;
    properties.forEach(function(g) { if ( g.final === 'pending' ) pending++; });
    actions.forEach(function(a) { if ( a.available.value === 'pending' || a.enabled.value === 'pending' ) pending++; });
    sections.forEach(function(s) { if ( s.available === 'pending' || ( s.perm && s.perm.result === 'pending' ) ) pending++; });
    permissions.forEach(function(p) { if ( p.result === 'pending' ) pending++; });

    var rec = P.describeRecord(data);
    return {
      cls: rec.cls, id: rec.id, summary: rec.summary, mode: modeName, modeDefaulted: ! mode, source: t.source,
      properties: properties, validation: validation, actions: actions, sections: sections,
      permissions: permissions, pending: pending
    };
  });
})();
