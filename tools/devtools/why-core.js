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
// value | 'ERR', perm(name) -> true|false|'pending' }.
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

  // Element2.js:1895-1900 — rw first; ro only when rw failed and reading is
  // not free. ro is null when FOAM would never have asked for it.
  exports.permMode = function(rw, ro, canRead, allowCreate) {
    if ( rw === 'pending' ) return 'pending';
    if ( rw || allowCreate ) return 'RW';
    if ( canRead ) return 'RO';
    if ( ro === 'pending' ) return 'pending';
    return ro ? 'RO' : 'HIDDEN';
  };

  // The gate record for a property whose replay itself threw, so the row
  // still renders and names the error. Same shape as propGate's result.
  exports.errGate = function(prop, msg) {
    return { name: prop.name, label: prop.label || prop.name, hidden: !! prop.hidden,
             base: { source: 'default', kind: 'value', mode: 'ERR', err: msg }, clamp: 'ERR', perm: null, final: 'ERR' };
  };

  exports.propGate = function(prop, modeName, data, env) {
    var gate = { name: prop.name, label: prop.label || prop.name, hidden: !! prop.hidden,
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
      var askRo = rw !== 'pending' && ! rw && ! allowCreate && ! canRead;
      if ( askRo ) ro = env.perm(roName);
      gate.perm = {
        rw: { name: rwName, result: rw },
        ro: askRo ? { name: roName, result: ro } : null,
        canRead: canRead, allowCreate: allowCreate,
        mode: exports.permMode(rw, ro, canRead, allowCreate)
      };
    }
    if ( gate.clamp === 'ERR' ) gate.final = 'ERR';
    else if ( ! gate.perm ) gate.final = gate.clamp;
    else if ( gate.perm.mode === 'pending' ) gate.final = 'pending';
    else gate.final = exports.combine(gate.clamp, gate.perm.mode);
    return gate;
  };

  function permsOf(names, env) {
    return ( names || [] ).map(function(n) { return { name: n, result: env.perm(n) }; });
  }
  function allGranted(perms) {
    var pending = false;
    for ( var i = 0 ; i < perms.length ; i++ ) {
      if ( perms[i].result === 'pending' ) pending = true;
      else if ( ! perms[i].result ) return false;
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

  // SectionAxiom.js: isAvailable(data) && (permissionRequired ? auth.check(cls.section.name) : true)
  // && at least one of its properties is not HIDDEN (SectionAxiom.js:125-165).
  // propGates: this record's propGate list; a section's members are its
  // explicit `properties` names, else every property whose `section` is it.
  exports.sectionGate = function(section, data, env, propGates, propSectionOf) {
    var avail = boolOf(section.isAvailable, data, env), perm = null;
    if ( section.permissionRequired && data && data.cls_ ) {
      var n = String(data.cls_.name).toLowerCase() + '.section.' + String(section.name).toLowerCase();
      perm = { name: n, result: env.perm(n) };
    }
    var members = null;
    if ( propGates ) {
      // A dotted entry ('a.b') is a PathPropertyHolder into another class
      // (SectionAxiom.js:113-117), not one of this record's gates: left out.
      var explicit = Array.isArray(section.properties)
        ? section.properties.map(function(p) { return typeof p === 'string' ? p : ( p && p.name ); })
                            .filter(function(n) { return n && n.indexOf('.') < 0; })
        : null;
      members = propGates.filter(function(g) {
        return explicit ? explicit.indexOf(g.name) >= 0 : ( propSectionOf && propSectionOf(g.name) === section.name );
      });
    }
    var anyVisible = members === null ? null : members.some(function(g) { return g.final !== 'HIDDEN'; });
    return { name: section.name, available: avail, perm: perm, fields: members ? members.length : null, anyVisible: anyVisible };
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamWhyCore = {} ));
