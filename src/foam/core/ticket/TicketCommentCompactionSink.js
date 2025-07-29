/**
 * @license
 * Copyright 2025 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketCommentCompactionSink',
  extends: 'foam.dao.ProxySink',
  implements: ['foam.lang.ContextAware'],

  documentation: `Sink which controls which Tickets comments can be compacted. Predicate is evaluated on owning Ticket.`,

  javaImports: [
    'foam.lang.X'
  ],

  properties: [
    {
      documentation: `Compact (keep) tickets comments which satisfy this predicate`,
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
      TicketComment comment = (TicketComment) obj;
      if ( comment != null ) {
        Ticket ticket = comment.findTicket(x);
        if ( getPredicate().f(ticket) ) {
          getDelegate().put(obj, sub);
        } else {
          ((foam.core.logger.Logger) x.get("logger")).info("TicketCommentCompactionSink,discard", comment.getId(), ticket.getId());
        }
      }
      `
    }
  ]
});
