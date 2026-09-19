/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Registers 'why': for the record in D.selection, replay every client-side
// gate (why-core.js, tested) with the page's real evaluators, and report the
// permission cache. Browser-only glue.
(function() {
  var D = window.__foamDevtools, W = window.__foamWhyCore;

  // Client auth is a decorator stack (AuthorizeAnonymousClientDecorator ->
  // CachedAuthServiceProxy -> ClientLoginAuthService); apps may re-stack it,
  // so walk .delegate until the object with the cache map appears.
  function authCache() {
    var a = window.ctrl && ctrl.__subContext__ && ctrl.__subContext__.auth, hops = 0;
    while ( a && hops < 10 ) {
      if ( a.cache && typeof a.cache === 'object' ) return a.cache;
      a = a.delegate; hops++;
    }
    return null;
  }

  // auth.check returns a promise and caches it; the panel needs a value now.
  // Resolve each promise once into permResults and answer 'pending' until it
  // lands — the panel re-polls.
  var permResults = {};
  function permOf(name) {
    if ( name in permResults ) return permResults[name];
    var auth = ctrl.__subContext__.auth;
    if ( ! auth ) return 'pending';
    var p;
    try { p = auth.check(null, name); } catch (e) { permResults[name] = false; return false; }
    if ( ! p || typeof p.then !== 'function' ) { permResults[name] = !! p; return permResults[name]; }
    p.then(function(v) { permResults[name] = !! v; }, function() { permResults[name] = false; });
    return 'pending';
  }

  var env = {
    evalFn: function(fn, data) {
      try { return foam.Function.withArgs(fn, data, data); }
      catch (e) { return { err: String(e && e.message).slice(0, 80) }; }
    },
    slotGet: function(s) { try { return s.get(); } catch (e) { return 'ERR'; } },
    perm: permOf
  };

  function str(v, max) { var s = String(v); return s.length > max ? s.slice(0, max) + '…' : s; }

  var P = window.__foamShapers;

  // What the panel polls to notice navigation: the route plus the stack
  // position (a push/back within the same hash still changes pos).
  D.register('screenKey', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var pos = -1;
    try { pos = ctrl.stack ? ctrl.stack.pos : -1; } catch (e) {}
    return { key: location.hash + '|' + pos };
  });

  // The record the panel should explain, in priority: an Elements selection
  // whose DOM node is still in the document (the selection's element keeps
  // element_ after detach, Element2.js:733-738), else the record the current
  // screen is about (the detail view under the navigation stack's current
  // view), else nothing.
  function target() {
    var sel = D.selection;
    try {
      if ( sel && sel.data && sel.view && sel.view.element_ && sel.view.element_.isConnected ) {
        return { data: sel.data, view: sel.view, dao: sel.dao, mode: sel.mode, source: 'selection' };
      }
    } catch (e) {}
    var root = null;
    try { root = ( ctrl.stack && ctrl.stack.current ) || ctrl; } catch (e) { root = ctrl; }
    var found = P.findScreenViews(root, { isDAO: P.isDAO });
    if ( found.record ) {
      var v = found.record.view, dao = null;
      try { dao = ( v.config && P.isDAO(v.config.dao) ) ? v.config.dao : null; } catch (e) {}
      return { data: found.record.data, view: v, dao: dao, mode: P.modeOf(v) || ( v.instance_ && v.instance_.controllerMode && v.instance_.controllerMode.name ) || null, source: 'screen' };
    }
    if ( found.table ) return { table: found.table, source: 'screen' };
    return null;
  }

  D.register('why', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var t = target();
    if ( ! t ) return { error: 'no record on this screen — open a record, or select one of its elements in Elements' };
    if ( t.table ) {
      var of = t.table.dao.of;
      return { error: 'this screen is a table of ' + ( of ? of.id : 'records' ) + ' — open a record, or select a row in Elements' };
    }
    D.selection = { data: t.data, view: t.view, dao: t.dao, mode: t.mode };
    window.$d = t.data;
    var data = t.data, cls = data.cls_;
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

    var sections = ( foam.layout && foam.layout.SectionAxiom )
      ? cls.getAxiomsByClass(foam.layout.SectionAxiom).map(function(s) { return W.sectionGate(s, data, env); })
      : [];

    var cache = authCache(), permissions = [];
    if ( cache ) Object.keys(cache).forEach(function(k) { permissions.push({ perm: k, result: permOf(k) }); });

    var pending = 0;
    properties.forEach(function(g) { if ( g.final === 'pending' ) pending++; });
    actions.forEach(function(a) { if ( a.available.value === 'pending' || a.enabled.value === 'pending' ) pending++; });
    permissions.forEach(function(p) { if ( p.result === 'pending' ) pending++; });

    var id = null, summary = null;
    try { id = ( data.id !== undefined && data.id !== null && data.id !== '' && data.id !== 0 ) ? str(data.id, 40) : null; } catch (e) {}
    try { summary = typeof data.toSummary === 'function' ? str(data.toSummary(), 60) : null; } catch (e) {}

    return {
      cls: cls.id, id: id, summary: summary || null, mode: modeName, modeDefaulted: ! mode, source: t.source,
      properties: properties, validation: validation, actions: actions, sections: sections,
      permissions: permissions, pending: pending
    };
  });
})();
