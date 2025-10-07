/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.approval',
  name: 'ApprovalRequestCompactionSink',
  extends: 'foam.dao.ProxySink',
  implements: ['foam.lang.ContextAware'],

  documentation: `Sink which controls which ApprovalRequests can be compacted. `,

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
      ApprovalRequest approval = (ApprovalRequest) obj;
      if ( approval != null ) {
        ((foam.core.logger.Logger) x.get("logger")).info("ApprovalRequestCompactionSink", approval.getId(), approval.getStatus());
        if ( getPredicate().f(approval) ) {
          getDelegate().put(obj, sub);
        } else {
          ((foam.core.logger.Logger) x.get("logger")).info("ApprovalRequestCompactionSink,discard", approval.getId(), approval.getStatus());
        }
      }
      `
    }
  ]
});
