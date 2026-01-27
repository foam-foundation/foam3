/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.RELATIONSHIP({
  cardinality: '*:*',
  sourceModel: 'foam.core.auth.Group',
  targetModel: 'foam.core.auth.Permission',
  forwardName: 'permissions',
  inverseName: 'groups',
  junctionDAOKey: 'groupPermissionJunctionDAO'
});

foam.RELATIONSHIP({
  cardinality: '1:*',
  sourceModel: 'foam.core.auth.Group',
  forwardName: 'children',
  targetModel: 'foam.core.auth.Group',
  inverseName: 'parent',
  sourceProperty: {
    hidden: true
  },
  targetProperty: {
    view: { class: 'foam.u2.view.ReferenceView', placeholder: '--' },
    menuKeys: ['admin.groups']
  }
});

/*
foam.RELATIONSHIP({
  cardinality: '*:*',
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.auth.Group',
  forwardName: 'groups',
  inverseName: 'users',
  sourceProperty: {
    hidden: true
  },
  targetProperty: {
    hidden: true
  }
});
*/

foam.RELATIONSHIP({
  cardinality: '1:*',
  sourceModel: 'foam.core.auth.UserUserJunction',
  targetModel: 'foam.core.notification.NotificationSetting',
  forwardName: 'notificationSettingsForUserUsers',
  inverseName: 'userJunction',
  sourceProperty: {
    hidden: true
  },
  sourceDAOKey: 'agentJunctionDAO',
  targetProperty: {
    hidden: true
  },
  targetDAOKey: 'notificationSettingDAO',
  unauthorizedTargetDAOKey: 'localNotificationSettingDAO'
});

foam.RELATIONSHIP({
  cardinality: '1:*',
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.notification.NotificationSetting',
  forwardName: 'notificationSettings',
  inverseName: 'owner',
  sourceProperty: {
    section: 'systemInformation',
    columnPermissionRequired: true
  },
  targetDAOKey: 'notificationSettingDAO',
  unauthorizedTargetDAOKey: 'localNotificationSettingDAO',
  targetProperty: {
    view: function(_, X) {
      var userDAOSlot = X.data.slot(spid => {
        if ( spid ) {
          return X.userDAO.where(X.data.EQ(X.data.User.SPID, spid));
        } else {
          return X.userDAO;
        }
      });
      return {
        class: 'foam.u2.view.ModeAltView',
        readView: 'foam.u2.view.ReadReferenceView',
        writeView: {
          class: 'foam.u2.view.RichChoiceReferenceView',
          sections: [
            {
              heading: 'Owner',
              dao$: userDAOSlot
            }
          ],
          placeholder: '--'
        }
      }
    },
    tableCellFormatter: { class: 'foam.u2.view.ReferenceToSummaryCellFormatter' }
  }
});

foam.RELATIONSHIP({
  sourceModel: 'foam.core.auth.User',
  targetModel: 'foam.core.auth.Credential',
  forwardName: 'credentials',
  inverseName: 'owner',
  cardinality: '1:*'
});

foam.RELATIONSHIP({
  sourceModel: 'foam.lang.Currency',
  targetModel: 'foam.core.auth.Country',
  forwardName: 'countries',
  inverseName: 'currency',
  cardinality: '1:*'
});