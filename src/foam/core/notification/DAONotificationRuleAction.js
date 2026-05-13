/**
 * @license
 * Copyright 2022 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.CLASS({
  package: 'foam.core.notification',
  name: 'DAONotificationRuleAction',
  implements: [ 'foam.core.ruler.RuleAction' ],

  documentation: `Generate Notification DAO operations`,

  javaImports: [
    'foam.lang.FObject',
    'foam.lang.PropertyInfo',
    'foam.dao.DAO',
    'foam.core.auth.User',
    'foam.core.auth.CreatedAware',
    'foam.core.auth.CreatedByAware',
    'foam.core.auth.LastModifiedAware',
    'foam.core.auth.LastModifiedByAware',
    'foam.util.StringUtil',
    'java.time.ZoneOffset',
    'java.time.format.DateTimeFormatter',
    'java.util.Date',
    'java.util.HashMap',
    'java.util.Map'
  ],

  properties: [
    {
      name: 'notificationTemplate',
      class: 'String'
    },
    {
      name: 'emailTemplate',
      class: 'String'
    },
    {
      name: 'group',
      class: 'Reference',
      of: 'foam.core.auth.Group'
    }
  ],

  javaCode: `
    protected static DateTimeFormatter sdf_ = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
                                                .withZone(ZoneOffset.UTC);
  `,
  
  methods: [
    {
      name: 'applyAction',
      javaCode: `
      Map args = new HashMap();

      args.put("of", obj.getClass().getSimpleName());
      args.put("dop", rule.getOperation().getName());

      // add all properties of obj as args
      var props = obj.getClassInfo().getAxiomsByClass(PropertyInfo.class);
      for ( PropertyInfo prop : props ) {
        var value = prop.get(obj);
        if ( value != null ) {
          args.put(prop.getName(), value.toString());
        }
        if ( oldObj != null ) {
          var oldValue = prop.get(oldObj);
          if ( oldValue != null ) {
            args.put("old"+StringUtil.capitalize(prop.getName()), oldValue.toString());
          }
        }
      }

      if ( obj instanceof CreatedAware ) {
        Date date = ((CreatedAware)obj).getCreated();
        if ( date != null ) {
          args.put("created", sdf_.format(date.toInstant()));
        }
      }
      if ( obj instanceof CreatedByAware ) {
        User user = (User) ((DAO) x.get("userDAO")).find(((CreatedByAware)obj).getCreatedBy());
        if ( user != null ) {
          args.put("createdBy", user.getLegalName());
        } else {
          // this can occur with repository provided entities
          args.put("createdBy", "");
        }
      }
      if ( obj instanceof LastModifiedAware ) {
        Date date = ((LastModifiedAware)obj).getLastModified();
        if ( date != null ) {
          args.put("lastModified", sdf_.format(date.toInstant()));
        }
      }
      if ( obj instanceof LastModifiedByAware ) {
        User user = (User) ((DAO) x.get("userDAO")).find(((LastModifiedByAware)obj).getLastModifiedBy());
        args.put("lastModifiedBy", user.getLegalName());
      }

      args.put("summary", ((FObject)obj).toSummary());

      StringBuilder sb = new StringBuilder();
      sb.append(obj.getClass().getSimpleName());
      sb.append(" ");
      sb.append(rule.getOperation());
      sb.append(" ");
      sb.append(obj);

      Notification notification = new Notification();
      notification.setBody(sb.toString());
      notification.setEmailArgs(args);
      notification.setSpid(rule.getSpid());
      if ( ! foam.util.SafetyUtil.isEmpty(getGroup()) ) notification.setGroupId(getGroup());
      notification.setTemplate(getNotificationTemplate());
      if ( ! foam.util.SafetyUtil.isEmpty(getEmailTemplate()) ) {
        notification.setEmailName(getEmailTemplate());
      }
      ((DAO) ruler.getX().get("notificationDAO")).put_(ruler.getX(), notification);
      `
    }
  ]
});
