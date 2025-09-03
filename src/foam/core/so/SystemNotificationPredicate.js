/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.so',
  name: 'SystemNotificationPredicate',
  extends: 'foam.mlang.predicate.Func',

  documentation: 'Function Predicate that returns true if any SystemNotifications are visible to the user for a given key.',

  properties: [
    {
      name: 'fn',
      value: async function(obj) {
        return (await obj.__subContext__.systemNotificationService
          .getSystemNotifications(null, this.key))?.length > 0;
      }
    },
    {
      class: 'String',
      name: 'key'
    }
  ],
  methods: [
    {
      name:'f',
      javaCode: `
        return true; // Cannot be evaluated in Java
      `
    }
  ]
});
