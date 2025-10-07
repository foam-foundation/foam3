/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.approval',
  name: 'ApprovableCompactionSink',
  extends: 'foam.dao.ProxySink',
  implements: ['foam.lang.ContextAware'],

  documentation: `Sink which controls which Approvables can be compacted. `,

  javaImports: [
    'foam.lang.X'
  ],

  properties: [
    {
      documentation: `Compact (keep) approvals which satisfy this predicate`,
      name: 'predicate',
      class: 'FObjectProperty',
      of: 'foam.mlang.predicate.Predicate',
      view: { class: 'foam.u2.view.JSONTextView' },
      javaFactory: `
      return foam.mlang.MLang.TRUE;
      `
    }
  ],

  methods: [
    {
      name: 'put',
      args: 'Any obj, foam.lang.Detachable sub',
      javaCode: `
      X x = getX();
      Approvable approval = (Approvable) obj;
      if ( approval != null ) {
        ((foam.core.logger.Logger) x.get("logger")).info("ApprovableCompactionSink", approval.getId(), approval.getStatus());
        if ( getPredicate().f(approval) ) {
          getDelegate().put(obj, sub);
        } else {
          ((foam.core.logger.Logger) x.get("logger")).info("ApprovableCompactionSink,discard", approval.getId(), approval.getStatus());
        }
      }
      `
    }
  ]
});
