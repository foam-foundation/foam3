/**
 * @license
 * Copyright 2020 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'NotificationExpansionDAO',
  extends: 'foam.dao.ProxyDAO',

  documentation: `Expands a notification from a group or broadcast notification to a user specific notification.`,

  imports: [
    'notificationTemplateDAO'
  ],

  javaImports: [
    'foam.lang.Agency',
    'foam.lang.ContextAgent',
    'foam.lang.Detachable',
    'foam.lang.FObject',
    'foam.lang.X',
    'foam.dao.AbstractSink',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.dao.ProxyDAO',
    'foam.dao.Sink',
    'foam.mlang.sink.Count',
    'foam.mlang.sink.Sequence',
    'foam.core.auth.Group',
    'foam.core.auth.LifecycleState',
    'foam.core.auth.User',
    'foam.core.logger.Logger',
    'foam.core.logger.Loggers',
    'foam.core.pm.PM',
    'foam.util.SafetyUtil',
    'foam.core.auth.Subject',
    'static foam.mlang.MLang.*'
  ],

  methods: [
    {
      name: 'put_',
      javaCode: `
        Logger logger = Loggers.logger(x, this);
        DAO userDAO = (DAO) x.get("localUserDAO");
        Notification notif = (Notification) obj;

        if (getDelegate().find(notif.getId()) != null)
          return getDelegate().put(notif);

        if ( notif.getBroadcasted() ) {
          Agency agency = (Agency) x.get("threadPool");
          agency.submit(x, new ContextAgent() {
            @Override
            public void execute(X x) {
              PM pm = PM.create(x, "Notification:broadcast");
              userDAO.where(
                AND(
                  EQ(User.LIFECYCLE_STATE, LifecycleState.ACTIVE),
                  HAS(User.GROUP)
              )).select(new UserNotificationSink(notif, (DAO) x.get("userNotificationDAO")));
              pm.log(x);
            }
          }, "Notification Broadcast");
        } else if ( Notification.GROUP_ID.isSet(notif) ) {
          Group group = (Group) ((DAO) x.get("groupDAO")).find(notif.getGroupId());
          if ( group == null ) {
            logger.info("WARN,Notification group not found", notif.getGroupId(), notif);
            return obj;
          }
          if ( ! group.getEnabled() ) {
            logger.debug("Notification group disabled", notif.getGroupId(), notif);
            return obj;
          }
          Agency agency = (Agency) x.get("threadPool");
          agency.submit(x, new ContextAgent() {
            @Override
            public void execute(X x) {
              PM pm = PM.create(x, "Notification:group");
              Count count = new Count();
              UserNotificationSink userNotificationSink = new UserNotificationSink(notif, (DAO) x.get("userNotificationDAO"));
              userNotificationSink.setX(x);
              Sequence seq = new Sequence.Builder(x)
                .setArgs(new Sink[] { count, userNotificationSink })
                .build();
              userDAO.where(
                AND(
                  EQ(User.GROUP, notif.getGroupId()),
                  EQ(User.LIFECYCLE_STATE, LifecycleState.ACTIVE)
              )).select(seq);
              if ( count.getValue() == 0 ) {
                logger.info("WARN,Notification group empty", notif);
              }
              pm.log(x);
            }
          }, "Notification Group");
        } else if ( notif.getUserId() > 0 ) {
          User user = notif.findUserId(x);
          if ( ! Notification.SPID.isSet(notif) ) {
            notif.setSpid(user.getSpid());
          }
          if ( user.getLifecycleState() == LifecycleState.ACTIVE ) {
            user.doNotify(x, notif);
          } else {
            logger.info("WARN,Notification user not active", notif);
          }
        } else {
          logger.info("WARN,Notification not saved", notif);
        }
        return notif;
      `
    }
  ]
});
