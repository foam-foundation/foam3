/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure helpers for the sidebar's rendering. Dual-exported so pathOf has a
// Node test; sidebar.js stays browser glue.
(function(exports) {
  exports.shortName = function(clsId) {
    var i = clsId.lastIndexOf('.');
    return i < 0 ? clsId : clsId.slice(i + 1);
  };

  // The FOAM-level selector Elements can't give: one segment per layer, root
  // first. The walk root is always window.ctrl, so it is written "ctrl". Each
  // other layer is its short class name plus the one thing that identifies it
  // — the DAO's context key, else the DAO's class, else the record id; a
  // property layer contributes just the property name.
  exports.pathOf = function(stack) {
    if ( ! stack.length ) return '';
    var parts = [ 'ctrl' ];
    for ( var i = stack.length - 2 ; i >= 0 ; i-- ) {
      var l = stack[i];
      if ( l.prop ) { parts.push(l.prop); continue; }
      var tag = l.dao ? ( l.dao.key || ( l.dao.of && exports.shortName(l.dao.of) ) )
              : ( l.data && l.data.id ) ? l.data.id : null;
      parts.push(exports.shortName(l.cls) + ( tag ? '[' + tag + ']' : '' ));
    }
    return parts.join(' › ');
  };
})(typeof module !== 'undefined' ? module.exports : ( window.__foamSidebarCore = {} ));
