/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Turns a gate record from why-core into the one sentence the panel shows in
// its "why" column: the step that decided, not the whole ladder. Pure and
// dual-exported so each rule has a Node test.
(function(exports) {
  function permWord(p) { return p.result === 'pending' ? 'pending' : ( p.result ? 'granted' : 'denied' ); }
  // A gate function's outcome in words: false, pending (async), or threw.
  function fnWord(name, v) {
    if ( v === 'pending' ) return name + ' pending (async)';
    if ( v && v.err ) return name + ' threw: ' + v.err;
    return name + ' → false';
  }

  exports.explainProp = function(g) {
    if ( g.final === 'ERR' ) return g.base.source + ' fn threw: ' + g.base.err;
    if ( g.final === 'pending' ) return 'permission check pending';
    var parts = [];
    var baseWord = g.base.kind === 'value' ? g.base.source : g.base.source + ' ' + g.base.kind;
    if ( g.base.mode !== 'RW' ) parts.push(baseWord + ' → ' + g.base.mode);
    if ( g.clamp !== g.base.mode ) parts.push('VIEW clamps RW → RO');
    if ( g.perm && g.perm.mode !== 'RW' && g.final !== g.clamp ) {
      // The deciding permission is ro when FOAM asked for it, else rw.
      var p = g.perm.ro || g.perm.rw;
      parts.push(p.name + ' ' + permWord(p) + ' → ' + g.perm.mode);
    } else if ( g.perm && g.perm.mode === 'RW' && ! g.perm.rw.result && g.perm.allowCreate ) {
      parts.push(g.perm.rw.name + ' denied but write not gated — no effect');
    }
    return parts.join('; ');
  };

  function permsWhy(perms) {
    for ( var i = 0 ; i < perms.length ; i++ ) if ( perms[i].result !== true ) return perms[i].name + ' ' + permWord(perms[i]);
    return null;
  }

  exports.explainAction = function(a) {
    var parts = [];
    if ( a.available.value !== true ) {
      parts.push('available: ' + ( a.available.fn === true ? permsWhy(a.available.perms) : fnWord('isAvailable', a.available.fn) ));
    }
    if ( a.enabled.value !== true ) {
      parts.push('enabled: ' + ( a.enabled.running ? 'running' : a.enabled.fn === true ? permsWhy(a.enabled.perms) : fnWord('isEnabled', a.enabled.fn) ));
    }
    if ( a.confirm.fn && a.confirm.fn.err ) parts.push(fnWord('confirmationRequired', a.confirm.fn));
    else if ( a.confirm.fn === true || ( a.confirm.perms.length && ! permsWhy(a.confirm.perms) ) ) parts.push('confirm required');
    return parts.join('; ');
  };

  // Ask why() again in 400 ms? While permission checks are pending, or on an
  // error right after navigation (the detail view has not loaded its record
  // yet: DetailView.loadData is idled + a find) — unless the page marked the
  // error final (a table screen stays a table) — and only while re-polls are
  // left.
  exports.shouldRepoll = function(w, pollsLeft) {
    return !! w && pollsLeft > 0 && ( w.pending > 0 || !! ( w.error && ! w.final ) );
  };

  exports.explainSection = function(s) {
    var parts = [];
    if ( s.available !== true ) parts.push(fnWord('isAvailable', s.available));
    if ( s.perm && s.perm.result !== true ) parts.push(s.perm.name + ' ' + permWord(s.perm));
    if ( s.anyVisible === false ) parts.push('all ' + s.fields + ' fields HIDDEN');
    return parts.join('; ');
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamWhyExplain = {} ));
