/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ruler',
  name: 'Ruled',
  abstract: true,

  documentation: 'Abstract protocol/trait for rule-like models.',

  implements: [
    'foam.mlang.Expressions'
  ],

  requires: [
    'foam.mlang.predicate.True'
  ],

  javaImports: [
    'foam.core.logger.Logger'
  ],

  properties: [
    {
      class: 'Boolean',
      name: 'enabled',
      documentation: 'Enables the rule.',
      value: true,
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'Int',
      name: 'priority',
      documentation: `Priority defines the order in which rules are to be applied.
        Rules with a higher priority are to be applied first.
        The convention for values is ints that are multiple of 10.
      `,
      readPermissionRequired: true,
      writePermissionRequired: true
    },
    {
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      name: 'predicate',
      documentation: 'predicate is checked against an object; if returns true, the action is executed. Defaults to return true.',
      factory: function () {
        return this.True.create();
      },
      javaFactory: `
        return foam.mlang.MLang.TRUE;
      `,
      tableCellFormatter: function(value) {
        this.add(value.toString());
      }
    },
    {
      class: 'Reference',
      of: 'foam.core.ruler.RuleGroup',
      name: 'ruleGroup',
      value: 'default',
      documentation: 'The name of the ruleGroup associated with the rule.',
      writePermissionRequired: true
    }
  ],

  methods: [
    {
      name: 'f',
      type: 'Boolean',
      args: [
        { name: 'x', type: 'Context' }
      ],
      javaCode: `
        if ( ! getEnabled() ) return false;

        var obj = x.get("OBJ");
        try {
          return getPredicate().f(obj != null ? obj : x);
        } catch (Throwable t) {
          ((Logger) x.get("logger")).error("Failed to evaluate predicate on",
            "class: " + getClass().getName(),
            "id: " + String.valueOf(getProperty("id")), t);
        }

        return false;
      `
    }
  ]
});
