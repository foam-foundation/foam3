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
  function authCache(auth) {
    var a = auth, hops = 0;
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
  // The file's only state across calls.
  var settled = new WeakMap();
  function settle(p) {
    if ( settled.has(p) ) return settled.get(p);
    p.then(function(v) { settled.set(p, !! v); }, function() { settled.set(p, false); });
    return 'pending';
  }

  // The evaluators why-core replays with, for one record's auth. FOAM asks
  // the auth in the record's own context (Element2.js:1889-1890); with none,
  // perm answers null and why-core applies FOAM's three readings of it
  // (property HIDDEN, action check skipped, permissionRequired section blocked).
  function envFor(auth) {
    return {
      // withArgs is what FOAM's own slots use (Action.js:253); a thenable result
      // means "not yet" until it lands (PromiseSlot, Slot.js:578-586).
      evalFn: function(fn, data) {
        var r;
        try { r = foam.Function.withArgs(fn, data, data); }
        catch (e) { return { err: P.str(e && e.message, 80) }; }
        return ( r && typeof r.then === 'function' ) ? settle(r) : r;
      },
      slotGet: function(s) { try { return s.get(); } catch (e) { return 'ERR'; } },
      perm: function(name) {
        if ( ! auth ) return null;
        var p;
        try { p = auth.check(null, name); } catch (e) { return false; }
        if ( ! p || typeof p.then !== 'function' ) return !! p;
        return settle(p);
      }
    };
  }

  D.register('why', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var t = D.currentTarget();
    if ( ! t ) return { error: D.NO_RECORD };
    if ( t.table ) {
      var of = t.table.dao.of;
      // final: nothing to wait for — a table stays a table until navigation
      return { error: 'this screen is a table of ' + ( of ? of.id : 'records' ) + ' — open a record, or select a row in Elements', final: true };
    }
    D.publishHandles(t);
    var data = t.data, cls = data.cls_, auth = null;
    try { auth = ( data.__subContext__ && data.__subContext__.auth ) || null; } catch (e) {}
    var env = envFor(auth);
    // No controllerMode in scope is what FOAM turns into CREATE (Element2.js:569).
    var mode = t.mode || null, modeName = mode || 'CREATE';

    var sectionAxioms = ( foam.layout && foam.layout.SectionAxiom ) ? cls.getAxiomsByClass(foam.layout.SectionAxiom) : [];
    var listed = W.listedProps(sectionAxioms);
    var propAxioms = cls.getAxiomsByClass(foam.lang.Property);
    var properties = propAxioms.map(function(p) {
      try { return W.propGate(p, modeName, data, env, listed[p.name] === true); }
      catch (e) { return W.errGate(p, P.str(e.message, 80)); }
    });

    // errors_ is [ propertyAxiom, message ] pairs (Validation.js:476-482)
    var validation = [];
    try {
      ( data.errors_ || [] ).forEach(function(e) {
        var prop = e[0], v;
        try { v = P.str(prop.f(data), 60); } catch (err) { v = 'ERR'; }
        validation.push({ name: prop.name, value: v, message: P.str(e[1], 160) });
      });
    } catch (e) { validation.push({ name: '(errors_)', value: '', message: 'threw: ' + P.str(e.message, 100) }); }

    var actionAxioms = cls.getAxiomsByClass(foam.lang.Action);
    var actions = actionAxioms.map(function(a) {
      var running = false;
      try { running = !! a.getRunning$(data).get(); } catch (e) {}
      return W.actionGate(a, data, env, running);
    });

    // A section is also unavailable when every property in it is HIDDEN and
    // none of its actions is available (SectionAxiom.js:103-165); members
    // come from its explicit `properties` / `actions` lists or from each
    // axiom's `section` (SectionAxiom.js:108-123, :137-146).
    var sectionOf = {}, actionSectionOf = {};
    propAxioms.forEach(function(p) { try { sectionOf[p.name] = p.section || null; } catch (e) {} });
    actionAxioms.forEach(function(a) { try { actionSectionOf[a.name] = a.section || null; } catch (e) {} });
    var sections = sectionAxioms.map(function(s) {
      return W.sectionGate(s, data, env, properties, function(n) { return sectionOf[n]; },
                           actions, function(n) { return actionSectionOf[n]; });
    });

    var cache = authCache(auth), permissions = [];
    if ( cache ) Object.keys(cache).forEach(function(k) { permissions.push({ perm: k, result: env.perm(k) }); });

    var pending = 0;
    properties.forEach(function(g) { if ( g.final === 'pending' ) pending++; });
    actions.forEach(function(a) { if ( a.available.value === 'pending' || a.enabled.value === 'pending' ) pending++; });
    sections.forEach(function(s) { if ( s.available === 'pending' || ( s.perm && s.perm.result === 'pending' ) || s.anyVisible === 'pending' ) pending++; });
    permissions.forEach(function(p) { if ( p.result === 'pending' ) pending++; });

    var rec = P.describeRecord(data);
    return {
      cls: rec.cls, id: rec.id, summary: rec.summary, mode: modeName, modeDefaulted: ! mode, source: t.source,
      properties: properties, validation: validation, actions: actions, sections: sections,
      permissions: permissions, pending: pending
    };
  });
})();
