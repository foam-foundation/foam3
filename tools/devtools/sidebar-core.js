/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// Pure helpers for describing a stack layer, shared by the sidebar and the
// Tree tab. Dual-exported so each has a Node test; sidebar.js and panel.js
// stay browser glue.
(function(exports) {
  exports.shortName = function(clsId) {
    var i = clsId.lastIndexOf('.');
    return i < 0 ? clsId : clsId.slice(i + 1);
  };

  // What a layer is bound to, in the words both the sidebar and the Tree tab
  // use: the view it stands for, the DAO (context key, else class), or the
  // record (class, id, summary). A property layer's prop is shown separately.
  exports.bindingText = function(l) {
    if ( l.view ) return 'bound to ' + exports.shortName(l.view);
    if ( l.dao ) return l.dao.key ? 'dao ' + l.dao.key : ( l.dao.of ? 'dao of ' + exports.shortName(l.dao.of) : 'dao' );
    if ( l.data ) {
      var s = exports.shortName(l.data.cls);
      if ( l.data.id ) s += ' #' + l.data.id;
      if ( l.data.summary ) s += ' — ' + l.data.summary;
      return s;
    }
    return '';
  };

  // A layer's whole label after the class name: the binding, then the
  // property when the layer has one.
  exports.layerText = function(l) {
    var b = exports.bindingText(l), p = l.prop ? 'prop ' + l.prop : '';
    return [ b, p ].filter(Boolean).join('  ');
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
