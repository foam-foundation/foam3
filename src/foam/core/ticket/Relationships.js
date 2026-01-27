/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.RELATIONSHIP({
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.ticket.Ticket',
  forwardName: 'tickets',
  inverseName: 'owner',
  cardinality: '1:*',
  sourceDAOKey: 'userDAO',
  unauthorizedSourceDAOKey: 'localUserDAO',
  targetDAOKey: 'ticketDAO',
  unauthorizedTargetDAOKey: 'localTicketDAO',
  // REVIEW: unable to get owner to display in any section on Ticket.
  sourceProperty: {
    section: 'operationsInformation',
    order: 70,
    columnPermissionRequired: true
  },
  targetProperty: {
    visibility: 'RO',
    section: 'metaSection',
    tableCellFormatter: function(value) {
      this.add(this.__subSubContext__.userDAO.find(value)
        .then((user) => user && user.legalName ? user.legalName : value));
    },
    writePermissionRequired: true
  }
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.ticket.Ticket',
  targetModel: 'foam.core.ticket.TicketComment',
  forwardName: 'comments',
  inverseName: 'ticket',
  cardinality: '1:*',
  sourceDAOKey: 'ticketDAO',
  unauthorizedSourceDAOKey: 'localTicketDAO',
  targetDAOKey: 'ticketCommentDAO',
  unauthorizedTargetDAOKey: 'localTicketCommentDAO',
  targetProperty: {
    createVisibiltiy: 'HIDDEN',
    visibiltiy: 'RO'
  },
  sourceProperty: {
    visibility: 'RO',
    section: 'commentsSection',
    view: { class:  'foam.comics.InlineBrowserView', createEnabled: false, editEnabled: false, selectEnabled: false, exportEnabled: false }
  }
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.ticket.TicketComment',
  forwardName: 'ticketComments',
  inverseName: 'owner',
  cardinality: '1:*',
  sourceDAOKey: 'userDAO',
  unauthorizedSourceDAOKey: 'localUserDAO',
  targetDAOKey: 'ticketCommentDAO',
  unauthorizedTargetDAOKey: 'localTicketCommentDAO',
  targetProperty: {
    visibiltiy: 'RO',
    section: 'metaSection'
  },
  sourceProperty: {
    visibility: 'HIDDEN',
    columnPermissionRequired: true
  }
});
