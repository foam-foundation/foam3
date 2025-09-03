/**
 * @license
 * Copyright 2024 The FOAM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

foam.CLASS({
  package: 'foam.core.so',
  name: 'SystemNotificationServiceServer',
  implements: [ 'foam.core.so.SystemNotificationService' ],

  documentations: `Retrieve SystemNotifications defined by SystemOutages with SystemNotificiationTasks. SystemNotifications are optionally filtered by context Theme and argument 'key'. The message itself is also goes through translation.`,

  javaImports: [
    'foam.lang.X',
    'foam.dao.ArraySink',
    'foam.dao.DAO',
    'foam.i18n.TranslationService',
    'static foam.mlang.MLang.AND',
    'static foam.mlang.MLang.DESC',
    'static foam.mlang.MLang.EQ',
    'foam.core.auth.AuthService',
    'foam.core.pm.PM',
    'foam.core.theme.Theme',
    'foam.core.logger.Logger',
    'foam.util.SafetyUtil',
    'java.util.ArrayList',
    'java.util.Arrays',
    'java.util.List',
    'foam.net.CIDR',
    'foam.net.IPSupport'
  ],

  methods: [
    {
      name: 'getSystemNotifications',
      javaCode: `
      PM pm = PM.create(getX(), "SystemNotificationServer", "getSystemNotifications");
      try {
        TranslationService translationService = (TranslationService) x.get("translationService");
        String locale = (String) x.get("locale.language");
        if ( locale == null ) {
          locale = "en";
        }

        List<SystemOutage> outages = (List) ((ArraySink) ((DAO) getX().get("systemOutageDAO"))
          .where(AND(
            EQ(SystemOutage.ENABLED, true),
            EQ(SystemOutage.ACTIVE, true)
          ))
          .orderBy(DESC(SystemOutage.START_TIME))
          .select(new ArraySink()))
          .getArray();
        List<SystemNotification> notifications = new ArrayList();
        // If no remote IP, return empty array.
        String remoteIp = foam.net.IPSupport.instance().getRemoteIp(x);
        if ( remoteIp == null ) return notifications.toArray(new SystemNotification[0]);
        for ( SystemOutage outage : outages ) {
          Theme theme = (Theme) x.get("theme");
          List<SystemOutageTask> tasks = (List) ((ArraySink) outage.getTasks(getX()).select(new ArraySink())).getArray();
          for ( SystemOutageTask task : tasks ) {
            if ( task instanceof SystemNotificationTask ) {
              SystemNotificationTask snt = (SystemNotificationTask) task;
              if ( ! snt.getEnabled() ) continue;
              if ( snt.getThemes() != null &&
                   snt.getThemes().length > 0 ) {
                boolean match = false;
                if ( theme != null ) {
                  for ( String id : snt.getThemes() ) {
                    if ( id.equals(theme.getId()) ) {
                      match = true;
                      break;
                    }
                  }
                }
                if ( ! match ) continue;
              }
              if ( snt.getPermissions() != null &&
                   snt.getPermissions().length > 0 ) {
                boolean match = false;
                AuthService auth = (AuthService) x.get("auth");
                for ( String perm : snt.getPermissions() ) {
                  if ( auth.check(x, perm) ) {
                    match = true;
                    break;
                  }
                }
                if ( ! match ) continue;
              }
              if ( snt.getCidrWhiteList() != null &&
                   snt.getCidrWhiteList().length > 0 ) {
                boolean match = false;
                foam.net.CIDR[] cidrs = snt.getCidrWhiteList();

                for ( foam.net.CIDR cidr : cidrs ) {
                  try {
                    if ( cidr.inRange(x, remoteIp) ) {
                      match = true;
                      break;
                    }
                  } catch (java.net.UnknownHostException e) {
                    ((foam.core.logger.Logger) x.get("logger")).warning(this.getClass().getSimpleName(), "getSystemNotifications", remoteIp, e.getMessage());
                  }
                }
                if ( ! match ) continue;
              }
              SystemNotification sn = (SystemNotification) ((SystemNotificationTask)task).getSystemNotification().fclone();
              if ( key != null &&
                   ! key.equals(sn.getKey()) ) {
                continue;
              }
              if ( translationService != null ) {
                sn.setMessage(translationService.getTranslation(locale, sn.getMessage(), sn.getMessage()));
              }
              notifications.add(sn);
            }
          }
        }
        return notifications.toArray(new SystemNotification[notifications.size()]);
      } finally {
        pm.log(getX());
      }
      `
    }
  ]
})
