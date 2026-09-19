/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

// "Open in FOAM": push the comics edit view for the selected record onto
// the app's navigation stack. FOAM draws it; the extension only names what
// to show. Same StackBlock call the comics controllers make themselves
// (DAOSummaryView.js:180).
(function() {
  var D = window.__foamDevtools;

  function push(view) {
    var stack = ctrl.stack;
    if ( ! stack ) throw new Error('app has no stack (ctrl.stack)');
    stack.push(foam.u2.stack.StackBlock.create({ view: view, parent: ctrl }));
    return { ok: true };
  }

  // The selected record in the comics edit view when its DAO is known from
  // the view stack (D.selection.dao, set by inspect); otherwise a plain
  // sectioned detail view of the object, which still validates and shows
  // every property, but has no Save.
  D.register('openRecord', function() {
    if ( ! D.foamReady() ) return { foam: false };
    var sel = D.selection;
    if ( ! sel || ! sel.data ) return { error: 'no record selected — select an element inside a form or table in Elements' };
    var obj = sel.data, of = obj.cls_;
    if ( sel.dao ) {
      return push({
        class: 'foam.comics.v2.DAOUpdateView',
        data: obj,
        config: foam.comics.v2.DAOControllerConfig.create({ dao: sel.dao, of: of }, ctrl),
        of: of,
        title: 'Edit ' + of.name + ( obj.id !== undefined ? ' ' + obj.id : '' )
      });
    }
    return push({
      class: 'foam.u2.detail.SectionedDetailView',
      data: obj,
      controllerMode: foam.u2.ControllerMode.EDIT,
      title: of.name + ' (no DAO in view stack — detail only)'
    });
  });
})();
