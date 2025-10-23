/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.crunch',
  name: 'UserCapabilityTicket',
  extends: 'foam.core.ticket.Ticket',

  documentation: 'Assign a capability to one or more users.',

  implements: [
    'foam.mlang.Expressions'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.core.auth.User'
  ],

  properties: [
    {
      name: 'capability',
      class: 'Reference',
      of: 'foam.core.crunch.Capability',
      section: 'infoSection',
      required: true,
      order: 3
    },
    {
      class: 'Array',
      name: 'createdForUsers',
      label: 'Users',
      documentation: 'Users/businesses this ticket is created for.',
      section: 'infoSection',
      order: 4,
      view: function(_, X) {
        var userDAOSlot = X.data.slot(spid => {
          return X.userDAO.where(X.data.EQ(X.data.User.SPID, spid));
        });
        return {
          class: 'foam.u2.view.ReferenceArrayView',
          daoKey: 'userDAO',
          allowDuplicates: false,
          valueView: {
            class: 'foam.u2.view.RichChoiceReferenceView',
            search: true,
            sections: [
              {
                heading: 'Users',
                dao$: userDAOSlot,
                choicesLimit: 50
              }
            ]
          }
        };
      }
    },
    {
      name: 'status',
      order: 5,
      createVisibility: 'HIDDEN'
    },
    {
      name: 'createdFor',
      hidden: true,
      required: false
    },
    {
      name: 'assignedTo',
      hidden: true
    },
    {
      name: 'assignedToGroup',
      hidden: true
    },
    {
      name: 'comment',
      hidden: true
    },
    {
      name: 'externalComment',
      hidden: true
    }
  ]
})
