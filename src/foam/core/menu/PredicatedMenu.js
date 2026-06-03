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

    function launch(X, menu, e) {
      return this.findHandler(X).launch(X, menu, e);
    },

    function createView(X) {
      return this.findHandler(X).createView(X);
    },

    function xxxselect(X, menu) {
      return this.findHandler(X).select(X, menu);
    }
  ]
});
