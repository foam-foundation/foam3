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
  ]
});
