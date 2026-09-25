/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure replay of the client-side gates FOAM folds into slots: the property
// visibility ladder (foam.u2.Element2 createVisibilityFor), action
// availability (foam.lang.Action) and section availability
// (foam.layout.SectionAxiom). Each step is recorded instead of collapsed so
// the panel can name the one that decided. No foam global: the page hands in
// env = { evalFn(fn, data) -> value | 'pending' | {err}, slotGet(slot) ->
// value | 'ERR', perm(name) -> true|false|'pending'|null }. null is "no auth
// in scope", which FOAM answers three ways: a permission-gated property is
// HIDDEN (Element2.js:1888), an action skips the check (Action.js:218), a
// permissionRequired section stays unavailable — its permSlot is created
// false and nothing ever sets it (SectionAxiom.js:87-95).
(function(exports) {
  var MODE_PROP = { CREATE: 'createVisibility', VIEW: 'readVisibility', EDIT: 'updateVisibility' };

  // DisplayMode.restrictDisplayMode: HIDDEN wins, RW yields to the other side.
  exports.combine = function(a, b) {
    if ( a === 'HIDDEN' ) return 'HIDDEN';
    return b === 'RW' ? a : b;
  };

  // ControllerMode.restrictDisplayMode: only VIEW changes anything (RW -> RO).
  exports.clampFor = function(modeName, mode) {
    return ( modeName === 'VIEW' && mode === 'RW' ) ? 'RO' : mode;
  };

  function modeNameOf(v) {
    if ( v === undefined || v === null ) return 'RW';
    if ( typeof v === 'string' ) return v.toUpperCase();
    if ( v.name ) return String(v.name);
    return 'ERR';
  }

  // Element2.js:1888-1900 — no auth is HIDDEN outright; else rw first, ro
  // only when rw failed and reading is not free. ro is null when FOAM would
  // never have asked for it.
  exports.permMode = function(rw, ro, canRead, allowCreate) {
    if ( rw === null ) return 'HIDDEN';
    if ( rw === 'pending' ) return 'pending';
    if ( rw || allowCreate ) return 'RW';
    if ( canRead ) return 'RO';
    if ( ro === 'pending' ) return 'pending';
    return ro ? 'RO' : 'HIDDEN';
  };

  // The gate record for a property whose replay itself threw, so the row
  // still renders and names the error. Same shape as propGate's result;
  // reads only the name, since any other getter may be what threw.
  exports.errGate = function(prop, msg) {
    return { name: prop.name, label: prop.name, hidden: false, listed: false,
             base: { source: 'default', kind: 'value', mode: 'ERR', err: msg }, clamp: 'ERR', perm: null, final: 'ERR' };
  };

  // listed: a SectionAxiom names this property in its explicit `properties`
  // list. Section.js keeps every listed property (:161-175) and drops
  // `hidden: true` only when it collects a section's members by their
  // `section` (:178); AbstractSectionedDetailView.js:134 does the same for
  // the leftover section. So hidden decides the outcome only when nothing
  // lists the property.
  exports.propGate = function(prop, modeName, data, env, listed) {
    var gate = { name: prop.name, label: prop.label || prop.name, hidden: !! prop.hidden, listed: !! listed,
                 base: null, clamp: null, perm: null, final: null };
    var modeProp = MODE_PROP[modeName];
    var source = prop.visibility ? 'visibility' : ( modeProp && prop[modeProp] ) ? modeProp : 'default';
    var v = source === 'default' ? undefined : prop[source];
    var base = { source: source, kind: 'value', mode: 'RW', err: null };
    if ( typeof v === 'function' ) {
      base.kind = 'function';
      var r = env.evalFn(v, data);
      if ( r && r.err ) { base.mode = 'ERR'; base.err = r.err; }
      else base.mode = modeNameOf(r);
    } else if ( v && typeof v.get === 'function' ) {
      base.kind = 'slot';
      base.mode = modeNameOf(env.slotGet(v));
    } else {
      base.mode = modeNameOf(v);
    }
    gate.base  = base;
    // FOAM wraps controllerMode.restrictDisplayMode only around a visibility
    // FUNCTION's result (Element2.js:1854-1856); a DisplayMode value or a slot
    // is used as-is (:1841-1842, :1861), so `visibility: 'RW'` stays RW in VIEW.
    gate.clamp = base.mode === 'ERR' ? 'ERR'
               : base.kind === 'function' ? exports.clampFor(modeName, base.mode)
               : base.mode;

    var needsPerm = prop.readPermissionRequired || prop.writePermissionRequired || prop.updatePermissionRequired;
    if ( needsPerm && data && data.cls_ ) {
      var cls = String(data.cls_.name).toLowerCase(), pn = String(prop.name).toLowerCase();
      var canRead     = prop.readPermissionRequired !== true;
      var allowCreate = prop.writePermissionRequired !== true &&
                        ( prop.updatePermissionRequired !== true || modeName === 'CREATE' );
      var rwName = cls + '.rw.' + pn, roName = cls + '.ro.' + pn;
      var rw = env.perm(rwName), ro = null;
      var askRo = rw !== null && rw !== 'pending' && ! rw && ! allowCreate && ! canRead;
      if ( askRo ) ro = env.perm(roName);
      gate.perm = {
        rw: { name: rwName, result: rw },
        ro: askRo ? { name: roName, result: ro } : null,
        canRead: canRead, allowCreate: allowCreate,
        mode: exports.permMode(rw, ro, canRead, allowCreate)
      };
    }
    if ( gate.clamp === 'ERR' ) gate.ladder = 'ERR';
    else if ( ! gate.perm ) gate.ladder = gate.clamp;
    else if ( gate.perm.mode === 'pending' ) gate.ladder = 'pending';
    else gate.ladder = exports.combine(gate.clamp, gate.perm.mode);
    // An unlisted `hidden: true` is filtered out before any of the above
    // runs, so the field is HIDDEN whatever the ladder says. ladder is kept
    // for sectionGate: a section's own "any property visible" check does not
    // filter hidden (SectionAxiom.js:124-135).
    gate.final = ( gate.hidden && ! gate.listed ) ? 'HIDDEN' : gate.ladder;
    return gate;
  };

  function permsOf(names, env) {
    return ( names || [] ).map(function(n) { return { name: n, result: env.perm(n) }; });
  }
  // null (no auth) counts as granted: Action.js:218 returns the slot
  // untouched when there is no auth to ask.
  function allGranted(perms) {
    var pending = false;
    for ( var i = 0 ; i < perms.length ; i++ ) {
      if ( perms[i].result === 'pending' ) pending = true;
      else if ( perms[i].result !== null && ! perms[i].result ) return false;
    }
    return pending ? 'pending' : true;
  }
  // An async isAvailable/isEnabled yields a promise; FOAM's ExpressionSlot is
  // a PromiseSlot that keeps the old value (null = not available) until it
  // resolves (Slot.js:578-586). env.evalFn answers 'pending' for a thenable
  // until it lands, same as env.perm. A throw comes back as {err} and is
  // kept as such: "threw" is a different gate from "returned false".
  function boolOf(fn, data, env) {
    if ( ! fn ) return true;
    var r = env.evalFn(fn, data);
    if ( r === 'pending' || ( r && r.err ) ) return r;
    return !! r;
  }
  function andAll(fn, perms) {
    if ( fn === false || ( fn && fn.err ) || perms === false ) return false;
    if ( fn === 'pending' || perms === 'pending' ) return 'pending';
    return true;
  }

  // Action.js: available = isAvailable(data) && availablePermissions all
  // granted; enabled = !running && isEnabled(data) && enabledPermissions.
  exports.actionGate = function(action, data, env, running) {
    var aFn = boolOf(action.isAvailable, data, env), aPerms = permsOf(action.availablePermissions, env);
    var eFn = boolOf(action.isEnabled, data, env),   ePerms = permsOf(action.enabledPermissions, env);
    var cFn = action.confirmationRequired ? boolOf(action.confirmationRequired, data, env) : null;
    var cPerms = permsOf(action.confirmationRequiredPermissions, env);
    var enabled = running ? false : andAll(eFn, allGranted(ePerms));
    return {
      name: action.name, label: action.label || action.name,
      available: { fn: aFn, perms: aPerms, value: andAll(aFn, allGranted(aPerms)) },
      enabled:   { fn: eFn, perms: ePerms, running: !! running, value: enabled },
      confirm:   { fn: cFn, perms: cPerms }
    };
  };

  // The property names that some section lists explicitly (Section.js:161):
  // string entries and { name } entries, minus dotted paths into another
  // class. `properties` is read only when the axiom carries its own list,
  // through the axiom's own hasOwnProperty as Section.js:161 and
  // SectionAxiom.js:108 call it: FObject.js:449-455 answers from instance_,
  // where a FOAM object keeps its values, so the native own-key check would
  // say false on every real axiom.
  exports.listedProps = function(sectionAxioms) {
    var out = {};
    ( sectionAxioms || [] ).forEach(function(s) {
      var list = null;
      try { if ( s.hasOwnProperty('properties') && Array.isArray(s.properties) ) list = s.properties; } catch (e) {}
      ( list || [] ).forEach(function(p) {
        var n = typeof p === 'string' ? p : ( p && p.name );
        if ( n && n.indexOf('.') < 0 ) out[n] = true;
      });
    });
    return out;
  };

  // The gates that belong to a section: its explicit name list (`properties`
  // / `actions`), else every axiom whose `section` is it. A dotted entry
  // ('a.b') is a PathPropertyHolder into another class (SectionAxiom.js:113-117),
  // not one of this record's gates: left out.
  function membersOf(list, gates, sectionOf, sectionName) {
    if ( ! gates ) return null;
    var explicit = Array.isArray(list)
      ? list.map(function(p) { return typeof p === 'string' ? p : ( p && p.name ); })
            .filter(function(n) { return n && n.indexOf('.') < 0; })
      : null;
    return gates.filter(function(g) {
      return explicit ? explicit.indexOf(g.name) >= 0 : ( sectionOf && sectionOf(g.name) === sectionName );
    });
  }

  // SectionAxiom.js: isAvailable(data) && (permissionRequired ? auth.check(cls.section.name) : true)
  // && (one of its properties is not HIDDEN || one of its actions is available)
  // (SectionAxiom.js:103-165). propGates / actionGates: this record's gate lists.
  // anyVisible is true, false, or 'pending' when only an async isAvailable
  // could still turn it true.
  exports.sectionGate = function(section, data, env, propGates, propSectionOf, actionGates, actionSectionOf) {
    var avail = boolOf(section.isAvailable, data, env), perm = null;
    if ( section.permissionRequired && data && data.cls_ ) {
      var n = String(data.cls_.name).toLowerCase() + '.section.' + String(section.name).toLowerCase();
      var r = env.perm(n);
      // no auth: the permSlot is created false and never set (SectionAxiom.js:87-95)
      perm = { name: n, result: r === null ? false : r, noAuth: r === null };
    }
    var props   = membersOf(section.properties, propGates, propSectionOf, section.name);
    var actions = membersOf(section.actions, actionGates, actionSectionOf, section.name);
    var anyVisible = null;
    if ( props !== null || actions !== null ) {
      // the section's own check runs the ladder on hidden properties too, so ladder, not final
      var propShown = ( props || [] ).some(function(g) { return g.ladder !== 'HIDDEN'; });
      var actShown  = ( actions || [] ).some(function(a) { return a.available.value === true; });
      var actMaybe  = ( actions || [] ).some(function(a) { return a.available.value === 'pending'; });
      anyVisible = ( propShown || actShown ) ? true : actMaybe ? 'pending' : false;
    }
    return { name: section.name, available: avail, perm: perm,
             fields: props ? props.length : null, actions: actions ? actions.length : null, anyVisible: anyVisible };
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamWhyCore = {} ));
