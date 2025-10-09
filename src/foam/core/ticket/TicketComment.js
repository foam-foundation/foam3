/**
 * @license
 * Copyright 2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.ticket',
  name: 'TicketComment',

  documentation: 'Ticket Comment',

  implements: [
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware'
  ],

  imports: [
    'userDAO'
  ],

  javaImports: [
    'java.util.Date'
  ],

  tableColumns: [
    'created',
    'createdBy.legalName',
    'createdByAgent.legalName',
    'comment'
  ],

  sections: [
    {
      name: 'infoSection',
      title: 'Comment'
    },
    {
      name: 'metaSection',
      title: 'Audit'
    }
  ],

  properties: [
    {
      class: 'Long',
      name: 'id',
      hidden: true,
    },
    {
      class: 'String',
      name: 'comment',
      columnPermissionRequired: true,
      view: {
        class: 'foam.u2.tag.TextArea', rows: 5, cols: 144
      },
      section: 'infoSection'
    },
    {
      class: 'Boolean',
      name: 'external',
      documentation: 'only visible to ticket non-owner (group/organization) when true',
      value: false,
      section: 'infoSection'
    },
    {
      class: 'DateTime',
      name: 'created',
      visibility: 'RO',
      includeInDigest: true,
      section: 'metaSection'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdBy',
      visibility: 'RO',
      includeInDigest: true,
      projectionSafe: false,
      tableCellFormatter: function(value, obj) {
        obj.userDAO.find(value).then(function(user) {
          if ( user ) {
            this.add(user.legalName);
          }
        }.bind(this));
      },
      section: 'metaSection'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'createdByAgent',
      visibility: 'RO',
      includeInDigest: true,
      projectionSafe: false,
      tableCellFormatter: function(value, obj) {
        obj.userDAO.find(value).then(function(user) {
          if ( user ) {
            this.add(user.legalName);
          }
        }.bind(this));
      },
      section: 'metaSection'
    },
    {
      class: 'DateTime',
      name: 'lastModified',
      visibility: 'RO',
      section: 'metaSection'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'lastModifiedBy',
      visibility: 'RO',
      projectionSafe: false,
      tableCellFormatter: function(value, obj) {
        obj.userDAO.find(value).then(function(user) {
          if ( user ) {
            this.add(user.legalName);
          }
        }.bind(this));
      },
      section: 'metaSection'
    },
    {
      class: 'Reference',
      of: 'foam.core.auth.User',
      name: 'lastModifiedByAgent',
      visibility: 'RO',
      projectionSafe: false,
      tableCellFormatter: function(value, obj) {
        obj.userDAO.find(value).then(function(user) {
          if ( user ) {
            this.add(user.legalName);
          }
        }.bind(this));
      },
      section: 'metaSection'
    }
  ]
});
