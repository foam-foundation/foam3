/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'PredicatedMenuOption',

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'predicate',
      documentation: 'Predicate providing arbitrary checks, in addition to the regular menu auth checks.',
      /*
      view: {
        class: 'foam.u2.view.JSONTextView'
        },*/
      factory: function() { return foam.mlang.predicate.True.create(); },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `,
    },
    {
      __copyFrom__: 'foam.core.menu.Menu.HANDLER'
    }
  ]
});


foam.CLASS({
  package: 'foam.core.menu',
  name: 'PredicatedMenu',
  extends: 'foam.core.menu.AbstractMenu',

  documentation: `
    A DAOMenu which can accept a DAOControllerConfig and uses
    the v2 DAOController
  `,

  requires: [
    'foam.comics.v2.DAOControllerConfig'
  ],

  properties: [
    {
      class: 'FObjectArray',
      of: 'foam.core.menu.PredicatedMenuOption',
      name: 'options'
    }
  ],

  methods: [
    function findHandler(X) {
      for ( let i = 0 ; i < this.options.length ; i++ ) {
        let option = this.options[i];
        try {
          if ( i == this.options.length - 1 || option.predicate.f(X) )
            return option.handler;
        } catch (x) {
        }
      }
    },

    function clearRouteTail_(X, menu) {
      if ( X.topMemento_ ) {
        X.topMemento_.detachTail();
        X.topMemento_.tailStr = '';
      }

      if ( X.window && X.window.location.hash.substring(1) !== menu.id ) {
        X.window.history.replaceState(null, '', '#' + menu.id);
      }
    },

    function launch(X, menu, e) {
      var handler = this.findHandler(X);
      var isFlow = foam.core.menu.FlowMenu &&
        foam.core.menu.FlowMenu.isInstance(handler);

      if ( ! isFlow ) this.clearRouteTail_(X, menu);

      var ret = handler.launch(X, menu, e);
      var view = X.stack && X.stack.current;

      if ( view && X.currentProgram && X.currentProgram.clientProgram$ && X.pushMenu ) {
        view.onDetach(X.currentProgram.clientProgram$.sub(() => {
          if ( X.currentMenu && X.currentMenu.id !== menu.id ) return;
          handler = this.findHandler(X);
          isFlow = foam.core.menu.FlowMenu &&
            foam.core.menu.FlowMenu.isInstance(handler);

          if ( ! isFlow ) this.clearRouteTail_(X, menu);

          X.pushMenu(menu, true);
        }));
      }

      return ret;
    },

    function createView(X) {
      return this.findHandler(X).createView(X);
    },

    function xxxselect(X, menu) {
      return this.findHandler(X).select(X, menu);
    }
  ]
});
