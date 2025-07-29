/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketCompactionSink',
  extends: 'foam.dao.ProxySink',
  implements: ['foam.lang.ContextAware'],

  documentation: `Sink which controls which Tickets can be compacted. `,

  javaImports: [
    'foam.lang.X'
  ],

  properties: [
    {
      documentation: `Compact (keep) tickets which satisfy this predicate`,
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
      Ticket ticket = (Ticket) obj;
      if ( ticket != null ) {
        ((foam.core.logger.Logger) x.get("logger")).info("TicketCompactionSink", ticket.getId(), ticket.getStatus());
        if ( getPredicate().f(ticket) ) {
          getDelegate().put(obj, sub);
        } else {
          ((foam.core.logger.Logger) x.get("logger")).info("TicketCompactionSink,discard", ticket.getId(), ticket.getStatus());
        }
      }
      `
    }
  ]
});
