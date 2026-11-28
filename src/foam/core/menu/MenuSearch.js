/**
 * @license
 * Copyright 2026 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.menu',
  name: 'MenuSearch',

  documentation: `The side menus' search rule, in one place. A menu view that
    implements this and has a String menuSearch gets menuSearchPredicate_, to
    hand its TreeView as searchPredicate. It brings no requires or implements:
    the views already have foam.mlang.Expressions, and a second copy of its
    axioms fails to install.`,

  properties: [
    {
      class: 'foam.mlang.predicate.PredicateProperty',
      name: 'menuSearchPredicate_',
      documentation: `The search box as a test on each menu row: its label or one
        of its keywords holds the text, case ignored. TRUE with no text.`,
      expression: function(menuSearch) {
        var E    = foam.mlang.ExpressionsSingleton.create();
        var Menu = foam.core.menu.Menu;
        var text = menuSearch.trim();
        return text ?
          E.OR(E.CONTAINS_IC(Menu.LABEL, text), E.CONTAINS_IC(Menu.KEYWORDS, text)) :
          E.TRUE;
      }
    }
  ]
});
