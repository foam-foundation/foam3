/**
 * @license
 * Copyright 2019 The FOAM Authors. All Rights Reserved.
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

 foam.CLASS({
  package: 'foam.core.ruler',
  name: 'RuleGroup',

  documentation: 'A rule group groups some rules together, the rules within only run if the ruleGroup predicate evaluates to true.',

  javaImports: [
    'foam.mlang.sink.Count',
    'foam.core.auth.AuthService',
    'foam.core.auth.AuthorizationException',
    'foam.core.logger.Logger'
  ],

  implements: [
    'foam.core.auth.Authorizable',
    'foam.core.ruler.RulePredicate'
  ],

  properties: [
    {
      class: 'String',
      name: 'id'
    },
    {
      class: 'String',
      name: 'documentation',
      readPermissionRequired: true,
      writePermissionRequired: true
    },

    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      view: { class: 'foam.u2.view.JSONTextView' },
      javaFactory: `
      return foam.mlang.MLang.TRUE;
      `,
      documentation: 'predicate is checked against an object; if returns true, the rule group is executed. Defaults to return true.'
    },
    {
      class: 'Boolean',
      name: 'enabled',
      value: true,
      documentation: 'Enables the rule Group.',
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Int',
      name: 'priority',
      value: 10,
      documentation: `
        Support prioritizing rule group execution in the rule engine.
        Priority is a multiple of 10 in the range of (lowest) 0 -> inf (highest).
        Priority is defaulted to 10 so rule groups can ensure they go last by setting priority to 0
      `,
      help: 'Controls the order in which rule groups are evaluated. Higher values run first. Default is 10. Set to 0 to ensure a group runs last.',
      writePermissionRequired: true
    }
  ],

  methods: [
    {
      name: 'ruleF',
      javaCode: `
        try {
          return getEnabled() && getPredicate().ruleF(x, o, n);
        } catch (Throwable t) {
          try {
            // System.err.println("*********************** UNEXPECTED Predicate in RuleGroup");
            return getPredicate().f(n);
          } catch ( Throwable th ) { }

          ((Logger) x.get("logger")).error(
            "Failed to evaluate predicate of rule: " + getId(), t);
          return false;
        }
      `
    },
    {
      name: 'authorizeOnCreate',
      javaCode: `
        var auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "rulegroup.create") ) {
          throw new AuthorizationException("You do not have permission to create the rule group.");
        }
      `
    },
    {
      name: 'authorizeOnRead',
      javaCode: `
        var auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "rulegroup.read." + getId()) ) {
          throw new AuthorizationException("You do not have permission to read the rule group.");
        }
      `
    },
    {
      name: 'authorizeOnUpdate',
      javaCode: `
        var auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "rulegroup.update." + getId()) ) {
          throw new AuthorizationException("You do not have permission to update the rule group.");
        }
      `
    },
    {
      name: 'authorizeOnDelete',
      javaCode: `
        var auth = (AuthService) x.get("auth");
        if ( ! auth.check(x, "rulegroup.remove." + getId()) ) {
          throw new AuthorizationException("You do not have permission to delete the rule group.");
        }

        var count = (Count) getRules(x).select(new Count());
        if ( count.getValue() > 0 ) {
          throw new AuthorizationException("Non-empty rule group cannot be deleted.");
        }
      `
    }
  ]
});
