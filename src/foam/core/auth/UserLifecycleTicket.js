/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.core.auth',
  name: 'UserLifecycleTicket',
  extends: 'foam.core.ticket.Ticket',

  documentation: `Ticket to coordinate the changing of a User's lifecycle state.
Changing to 'DELETED', for example, will also mark associated UCJs as deleted.`,

  implements: [
    'foam.mlang.Expressions'
  ],

  javaImports: [
    'foam.dao.DAO',
    'foam.core.auth.User',
    'java.util.ArrayList',
    'java.util.List'
  ],

  imports: [
    'userDAO',
    'sessionDAO?'
  ],

  requires: [
    'foam.core.auth.User',
    'foam.core.session.Session',
    'foam.core.ticket.TicketComment'
  ],

  messages: [
    { name: 'COMMENT_REQUIRED', message: 'Comment required.' }
  ],

  properties: [
    {
      name: 'status',
      order: 5,
      createVisibility: 'HIDDEN'
    },
    {
      name: 'statusChoices',
      hidden: true,
      factory: function() {
        var s = [];
        if ( 'CLOSED' == this.status ) {
          s.push(['CLOSED', 'CLOSED']);
          s.push(['OPEN', 'OPEN']);
        } else {
          s.push(this.status);
          s.push(['CLOSED', 'CLOSED']);
        }
        return s;
      },
      compare: function() { return 0; }
    },
    {
      name: 'comment',
      section: 'infoSection',
      order: 6
    },
    {
      name: 'createdFor',
      gridColumns: '12',
      view: function(_, X) {
        return {
          class: 'foam.u2.view.RichChoiceView',
          search: true,
          sections: [
            {
              heading: 'Users',
              dao: X.userDAO,
              choicesLimit: 20
            }
          ],
          objToChoice: function(user) {
            return [user.id, user.legalName];
          }
        };
      }
    },
    {
      name: 'currentLifecycleState',
      class: 'foam.lang.Enum',
      of: 'foam.core.auth.LifecycleState',
      value: foam.core.auth.LifecycleState.PENDING,
      transient: true,
      compare: function() { return 0; },
      visibility: 'RO',
      section: 'infoSection',
      order: 7,
      gridColumns: 6
    },
    {
      name: 'requestedLifecycleState',
      class: 'foam.lang.Enum',
      of: 'foam.core.auth.LifecycleState',
      value: foam.core.auth.LifecycleState.DELETED,
      section: 'infoSection',
      order: 8,
      gridColumns: 6
    },
    {
      name: 'includeRelationships',
      class: 'Boolean',
      value: true,
      section: 'infoSection',
      order: 9,
      gridColumns: 6
    },
    {
      name: 'revertRelationships',
      class: 'Boolean',
      section: 'infoSection',
      order: 10,
      gridColumns: 6,
      createVisibility: 'RO',
      readVisibility: 'RO',
      updateVisibility: function(includeRelationships, updated) {
        return ( includeRelationships && updated && updated.length > 0 ) ? foam.u2.DisplayMode.RW : foam.u2.DisplayMode.DISABLED;
      }
    },
    {
      name: 'loggedIn',
      class: 'Boolean',
      value: false,
      transient: true,
      visibility: 'RO',
      section: 'infoSection',
      order: 11,
      gridColumns: 6
    },
    {
      name: 'lastActivity',
      class: 'Duration',
      transient: true,
      visibility: 'RO',
      section: 'infoSection',
      order: 12,
      gridColumns: 6
    },
    {
      name: 'message',
      class: 'String',
      createVisibility: 'HIDDEN',
      updateVisibility: 'RO',
      readVisibility: 'RO',
      section: 'infoSection',
      order: 13,
      gridColumns: 12
    },
    {
      name: 'updated',
      class: 'List',
      javaFactory: 'return new ArrayList();',
      createVisibility: 'HIDDEN',
      readVisibility: 'RO',
      updateVisibility: 'RO',
      section: 'infoSection',
      order: 14,
      gridColumns: 12
    },
    {
      documentation: 'Holds copy of last updated list for undo processing',
      name: 'current',
      class: 'List',
      transient: true,
      hidden: true,
      compare: function() { return 0; }
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
      name: 'externalComment',
      hidden: true
    },
    {
      documentation: 'Allow sink or rule to report exception',
      name: 'exception',
      class: 'Object',
      storageTransient: true,
      hidden: true,
      compare: function() { return 0; }
    },
    {
      name: 'comments',
      compare: function() { return 0; }
    }
  ],

  methods: [
    function init() {
      this.SUPER();
      this.fetchUserSession(this);
    },
    {
      name: 'fetchUserSession',
      code: function() {
        var self = this;
        // sessionDAO not accessible when user deleting self.
        if ( this.sessionDAO ) {
          this.userDAO.find(self.createdFor).then(function(user) {
            self.currentLifecycleState = user.lifecycleState;
          });
          this.sessionDAO.find(self.EQ(self.Session.USER_ID, self.createdFor)).then(function(session) {
            if ( ! session ) {
              self.loggedIn = false;
              self.clearProperty('lastActivity');
            } else {
              self.loggedIn = session.uses > 0 && session.remoteHost;
              self.lastActivity = Date.now() - session.lastUsed.getTime();
            }
          });
        }
      }
    }
  ],

  actions: [
    {
      // NOTE: Ticket.close uses TicketCloseCommand which doesn't allow for
      // failing the close operation if the user cannot or should not
      // be disabled or deleted.
      name: 'close',
      section: 'infoSection',
      confirmationRequired: function() {
        return true;
      },
      isEnabled: function(comment) {
        return comment;
      },
      isAvailable: function(status, id) {
        return id && status !== 'CLOSED';
      },
      code: async function(X) {
        var self = this;
        if ( ! this.comment ) {
          this.notify(this.COMMENT_REQUIRED, '', this.LogLevel.ERROR, true);
          return;
        }

        var ticket = this.clone();
        ticket.status = "CLOSED";

        return this.ticketDAO.put(ticket).then(res => {
          this.ticketDAO.cmd(this.AbstractDAO.PURGE_CMD);
          this.ticketDAO.cmd(this.AbstractDAO.RESET_CMD);
          this.finished.pub();
          this.notify(this.SUCCESS_CLOSED, '', this.LogLevel.INFO, true);
          self.pollDAO(X);
        }, e => {
          this.throwError.pub(e);
          this.notify(e.message, '', this.LogLevel.ERROR, true);
        });
      }
    },
    {
      class: 'foam.comics.v3.ComicsAction',
      name: 'save',
      isAvailable: () => false
    }
  ],

  listeners: [
    {
      name: 'pollDAO',
      isMerged: true,
      delay: 1000,
      code: function(X) {
        console.log('pollDAO');
        var self = this;
        return this.ticketDAO.find(this.id).then(function(t) {
          // NOTE: compare functions added to properties not to be
          // included in equals.
          if ( foam.util.equals(self, t) ) {
            X.detailView.finished.pub();
          } else {
            // Perform copyFrom. After a poll with no changes,
            // polling will end.

            // HACK: expecting FObject.js copyFrom to copy all properties,
            // but it's default copy logic uses hasOwnProperty, so only
            // explicitly defined properties of this subclass are copied.
            // Setting cls_ forces copyFrom to skip the default block and
            // just copy named properties which exist in both objects.
            t.cls_ = '';
            self.copyFrom(t);
            self.pollDAO(X);
          }
        });
      }
    }
  ]
});
